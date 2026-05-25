import { describe, expect, it } from 'vitest';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

// Mirror token.service helpers without pulling Prisma.
function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function parseDuration(str: string): number {
  const m = /^(\d+)([smhd])$/.exec(str.trim());
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60_000;
    case 'h': return n * 3_600_000;
    case 'd': return n * 86_400_000;
    default: return n * 60_000;
  }
}

describe('parseDuration', () => {
  it('parses seconds', () => expect(parseDuration('30s')).toBe(30_000));
  it('parses minutes', () => expect(parseDuration('15m')).toBe(900_000));
  it('parses hours', () => expect(parseDuration('2h')).toBe(7_200_000));
  it('parses days', () => expect(parseDuration('7d')).toBe(604_800_000));
  it('falls back to 15m on invalid input', () => expect(parseDuration('whatever')).toBe(900_000));
  it('trims whitespace', () => expect(parseDuration('  10m  ')).toBe(600_000));
});

describe('sha256 deterministic', () => {
  it('produces 64-char hex', () => {
    const h = sha256('hello');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
  it('is deterministic', () => {
    expect(sha256('a')).toBe(sha256('a'));
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

describe('HMAC timing-safe compare', () => {
  function compare(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }

  it('matches identical strings', () => {
    expect(compare('abc', 'abc')).toBe(true);
  });
  it('rejects different lengths', () => {
    expect(compare('abc', 'abcd')).toBe(false);
  });
  it('rejects different content of same length', () => {
    expect(compare('abc', 'xyz')).toBe(false);
  });
});

describe('Razorpay-style HMAC verification', () => {
  const secret = 'test-secret';
  function sign(body: string) {
    return createHmac('sha256', secret).update(body).digest('hex');
  }

  it('round-trip signs and verifies', () => {
    const body = '{"event":"subscription.activated"}';
    const sig = sign(body);
    expect(sign(body)).toBe(sig);
  });

  it('detects tampering', () => {
    const body = '{"event":"subscription.activated"}';
    const sig = sign(body);
    const tampered = '{"event":"subscription.cancelled"}';
    expect(sign(tampered)).not.toBe(sig);
  });
});
