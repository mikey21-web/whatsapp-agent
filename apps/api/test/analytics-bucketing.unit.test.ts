import { describe, expect, it } from 'vitest';

function daysAgo(n: number): Date {
  const d = new Date(Date.UTC(2025, 4, 25)); // fixed date for determinism
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function buildEmptyBuckets(days: number): { day: string; inbound: number; outbound: number }[] {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = startOfDayUtc(daysAgo(days - 1 - i));
    out.push({ day: d.toISOString().slice(0, 10), inbound: 0, outbound: 0 });
  }
  return out;
}

describe('analytics day bucketing', () => {
  it('produces N consecutive days', () => {
    const buckets = buildEmptyBuckets(7);
    expect(buckets).toHaveLength(7);
  });

  it('orders buckets ascending by date', () => {
    const buckets = buildEmptyBuckets(7);
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i]!.day > buckets[i - 1]!.day).toBe(true);
    }
  });

  it('uses YYYY-MM-DD format', () => {
    const buckets = buildEmptyBuckets(3);
    for (const b of buckets) {
      expect(b.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('initializes counts to zero', () => {
    const buckets = buildEmptyBuckets(5);
    for (const b of buckets) {
      expect(b.inbound).toBe(0);
      expect(b.outbound).toBe(0);
    }
  });
});
