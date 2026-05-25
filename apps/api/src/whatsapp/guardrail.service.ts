import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import type { WhatsappAccount } from '@diyaa/db';

const COLD_OUTBOUND_LOOKBACK_HOURS = 24;
const WARMUP_MAX_PER_DAY_BY_AGE_DAYS: { upTo: number; max: number }[] = [
  { upTo: 3, max: 50 },
  { upTo: 7, max: 250 },
  { upTo: 14, max: 1_000 },
  { upTo: 30, max: 5_000 },
];

interface PreflightInput {
  account: WhatsappAccount;
  toPhone: string;
  isTemplate: boolean;
  /// If false (default), strict cold-outbound rules apply.
  bypassColdCheck?: boolean;
}

interface PreflightResult {
  allow: boolean;
  reason?: string;
  /// True when the contact has had no inbound in the lookback window.
  isCold: boolean;
}

/**
 * Anti-ban guardrails for outbound WhatsApp.
 *
 * Applies four layers of protection:
 *  1. Manual pause (account.outboundPaused)
 *  2. Per-account rate limit (msgs / minute) using Redis sliding window
 *  3. Daily cap during warm-up (msgs / day, varies by number age)
 *  4. Cold-outbound block: refuse first message to a contact whose last inbound
 *     is older than 24h, unless this is an approved template message
 */
@Injectable()
export class GuardrailService {
  private readonly logger = new Logger('Guardrails');

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CONNECTION') private readonly redis: IORedis,
  ) {}

  async preflight(input: PreflightInput): Promise<PreflightResult> {
    const { account, toPhone, isTemplate, bypassColdCheck = false } = input;

    if (account.outboundPaused) {
      await this.logEvent(account.id, 'outbound_throttled', { reason: 'paused' });
      return { allow: false, reason: 'outbound paused for this account', isCold: false };
    }

    // 24h service window check (only matters for Cloud API non-template sends).
    const isCold = await this.isColdContact(account.clientId, toPhone);

    if (account.provider === 'META_CLOUD' && !isTemplate && isCold) {
      await this.logEvent(account.id, 'outbound_throttled', { reason: 'service_window', toPhone });
      return {
        allow: false,
        reason:
          'Outside the 24-hour service window. Send an approved template instead.',
        isCold,
      };
    }

    // Strict cold-outbound block on Evolution: reject cold sends entirely
    // (templates are unsupported on Evolution, so this is the safe default).
    if (account.provider === 'EVOLUTION' && isCold && !bypassColdCheck) {
      await this.logEvent(account.id, 'outbound_throttled', { reason: 'cold_outbound', toPhone });
      return {
        allow: false,
        reason:
          'No inbound from this contact in the last 24h. Sending cold messages risks a ban.',
        isCold,
      };
    }

    // Per-minute rate limit.
    const minuteOk = await this.consumeRate(account.id, account.msgsPerMinute, 60);
    if (!minuteOk) {
      await this.logEvent(account.id, 'outbound_throttled', {
        reason: 'rate_per_minute',
        cap: account.msgsPerMinute,
      });
      return { allow: false, reason: `Rate limit: ${account.msgsPerMinute}/min`, isCold };
    }

    // Daily cap during warm-up.
    if (account.warmupMode || account.msgsPerDay > 0) {
      const cap = account.msgsPerDay > 0 ? account.msgsPerDay : this.warmupCapForAge(account.createdAt);
      if (cap > 0) {
        const used = await this.dailyUsed(account.id);
        if (used >= cap) {
          await this.logEvent(account.id, 'outbound_throttled', {
            reason: 'daily_cap',
            cap,
            used,
          });
          // Refund the per-minute consumption so a slow retry tomorrow works.
          await this.refundRate(account.id);
          return { allow: false, reason: `Daily cap reached: ${cap}`, isCold };
        }
        await this.incrementDaily(account.id);
      }
    }

    return { allow: true, isCold };
  }

  /// Used to compensate when a downstream send fails: returns the slot to the bucket.
  async refundRate(accountId: string): Promise<void> {
    const key = rateKey(accountId);
    const cur = await this.redis.get(key);
    const n = Number(cur ?? 0);
    if (n > 0) await this.redis.decr(key);
  }

  async logEvent(
    accountId: string,
    kind: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.prisma.whatsappQualityEvent
      .create({ data: { whatsappAccountId: accountId, kind, payload: payload as object } })
      .catch((e) => this.logger.warn(`failed to log ${kind}: ${(e as Error).message}`));
  }

  private async isColdContact(clientId: string, phone: string): Promise<boolean> {
    const cleaned = phone.replace(/\D/g, '');
    const since = new Date(Date.now() - COLD_OUTBOUND_LOOKBACK_HOURS * 3600_000);
    const count = await this.prisma.message.count({
      where: {
        direction: 'INBOUND',
        createdAt: { gte: since },
        conversation: {
          clientId,
          contact: { phone: cleaned },
        },
      },
    });
    return count === 0;
  }

  private async consumeRate(accountId: string, limit: number, windowSec: number): Promise<boolean> {
    if (limit <= 0) return true;
    const key = rateKey(accountId);
    const next = await this.redis.incr(key);
    if (next === 1) await this.redis.expire(key, windowSec);
    return next <= limit;
  }

  private async dailyUsed(accountId: string): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    const key = `wa:daily:${accountId}:${day}`;
    const v = await this.redis.get(key);
    return Number(v ?? 0);
  }

  private async incrementDaily(accountId: string): Promise<void> {
    const day = new Date().toISOString().slice(0, 10);
    const key = `wa:daily:${accountId}:${day}`;
    const next = await this.redis.incr(key);
    if (next === 1) await this.redis.expire(key, 36 * 3600);
  }

  private warmupCapForAge(createdAt: Date): number {
    const ageDays = (Date.now() - createdAt.getTime()) / 86400_000;
    for (const tier of WARMUP_MAX_PER_DAY_BY_AGE_DAYS) {
      if (ageDays <= tier.upTo) return tier.max;
    }
    return 0; // no cap once past 30 days
  }
}

function rateKey(accountId: string): string {
  return `wa:rate:${accountId}`;
}
