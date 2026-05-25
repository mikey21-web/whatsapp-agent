import { HttpException, HttpStatus, Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import IORedis from 'ioredis';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const WINDOW_SEC = 60;

/**
 * Per-IP global throttle. Runs on every HTTP request not already excluded
 * (health, webhooks). Backed by Redis with a fixed-window counter.
 *
 * Limit defaults to 300 req/min, configurable via GLOBAL_RATE_LIMIT_PER_MIN.
 *
 * Authenticated principals get a higher cap so a busy team doesn't trip the
 * limit on legitimate inbox traffic. Anonymous traffic gets the strict cap.
 */
@Injectable()
export class GlobalRateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger('GlobalRateLimit');
  private readonly anonLimit: number;
  private readonly authedLimit: number;

  constructor(@Inject('REDIS_CONNECTION') private readonly redis: IORedis) {
    this.anonLimit = env.GLOBAL_RATE_LIMIT_PER_MIN;
    this.authedLimit = env.GLOBAL_RATE_LIMIT_AUTHED_PER_MIN;
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const ip = extractIp(req);
    const isAuthed = !!req.headers.authorization;
    const limit = isAuthed ? this.authedLimit : this.anonLimit;
    if (limit <= 0) return next();

    const minute = Math.floor(Date.now() / (WINDOW_SEC * 1000));
    const key = `gr:${ip}:${minute}`;

    let count: number;
    try {
      count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, WINDOW_SEC + 5);
    } catch (e) {
      // Redis hiccups should not take the API down — fail open.
      this.logger.warn(`redis unavailable for global rate limit: ${(e as Error).message}`);
      return next();
    }

    if (count > limit) {
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          details: { limit, windowSec: WINDOW_SEC },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    next();
  }
}

function extractIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim();
  if (Array.isArray(fwd) && fwd[0]) return fwd[0]!.split(',')[0]!.trim();
  return req.ip ?? 'unknown';
}
