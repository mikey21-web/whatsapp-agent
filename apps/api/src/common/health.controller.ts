import { Controller, Get } from '@nestjs/common';
import { Public } from './decorators';
import { PrismaService } from '../prisma/prisma.service';
import { Inject } from '@nestjs/common';
import IORedis from 'ioredis';

@Controller()
@Public()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CONNECTION') private readonly redis: IORedis,
  ) {}

  @Get('healthz')
  liveness(): { ok: true } {
    return { ok: true };
  }

  @Get('readyz')
  async readiness(): Promise<{ ok: boolean; checks: Record<string, boolean> }> {
    const checks = { db: false, redis: false };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch {
      /* db down */
    }
    try {
      const pong = await this.redis.ping();
      checks.redis = pong === 'PONG';
    } catch {
      /* redis down */
    }
    const ok = Object.values(checks).every(Boolean);
    return { ok, checks };
  }
}
