import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Inject } from '@nestjs/common';
import IORedis from 'ioredis';
import type { Request } from 'express';

export const RATE_LIMIT_KEY = 'rateLimit';

interface RateLimitConfig {
  windowSec: number;
  max: number;
}

export const RateLimit = (cfg: RateLimitConfig): MethodDecorator => {
  return (target, key, descriptor) => {
    Reflect.defineMetadata(RATE_LIMIT_KEY, cfg, descriptor.value as object);
    return descriptor;
  };
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('REDIS_CONNECTION') private readonly redis: IORedis,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const cfg = this.reflector.get<RateLimitConfig>(RATE_LIMIT_KEY, ctx.getHandler());
    if (!cfg) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip = (req.ip ?? req.headers['x-forwarded-for']?.toString() ?? 'unknown').split(',')[0]!.trim();
    const key = `rl:${req.method}:${req.url}:${ip}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, cfg.windowSec);
    if (count > cfg.max) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many requests' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
