import { describe, expect, it } from 'vitest';

/**
 * Pure-logic tests for the global per-IP rate limit decision.
 *
 * The middleware uses a fixed-window counter: bucket key is `gr:{ip}:{minute}`.
 * Within a single window, request N is allowed iff N <= limit.
 */

const WINDOW_SEC = 60;

function shouldAllow(args: { count: number; limit: number }): boolean {
  if (args.limit <= 0) return true; // 0 disables the limit
  return args.count <= args.limit;
}

function bucketKey(ip: string, atMs: number): string {
  const minute = Math.floor(atMs / (WINDOW_SEC * 1000));
  return `gr:${ip}:${minute}`;
}

function pickLimit(headers: Record<string, string | undefined>, anon: number, authed: number): number {
  return headers.authorization ? authed : anon;
}

function extractIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim();
  if (Array.isArray(fwd) && fwd[0]) return fwd[0]!.split(',')[0]!.trim();
  return req.ip ?? 'unknown';
}

describe('global rate limit decision', () => {
  it('allows requests up to the limit', () => {
    expect(shouldAllow({ count: 1, limit: 100 })).toBe(true);
    expect(shouldAllow({ count: 99, limit: 100 })).toBe(true);
    expect(shouldAllow({ count: 100, limit: 100 })).toBe(true);
  });

  it('rejects requests over the limit', () => {
    expect(shouldAllow({ count: 101, limit: 100 })).toBe(false);
    expect(shouldAllow({ count: 1_000_000, limit: 100 })).toBe(false);
  });

  it('limit=0 disables throttling', () => {
    expect(shouldAllow({ count: 999_999, limit: 0 })).toBe(true);
  });

  it('negative limit is treated as disabled', () => {
    expect(shouldAllow({ count: 999_999, limit: -1 })).toBe(true);
  });
});

describe('global rate limit bucket key', () => {
  it('uses the same key within the same minute', () => {
    const ip = '1.2.3.4';
    const a = bucketKey(ip, 1_700_000_000_000);
    const b = bucketKey(ip, 1_700_000_000_000 + 30_000); // 30s later
    expect(a).toBe(b);
  });

  it('rolls to a new key in the next minute', () => {
    const ip = '1.2.3.4';
    const a = bucketKey(ip, 1_700_000_000_000);
    const b = bucketKey(ip, 1_700_000_000_000 + 65_000); // 65s later
    expect(a).not.toBe(b);
  });

  it('different IPs have different keys', () => {
    const t = 1_700_000_000_000;
    expect(bucketKey('1.2.3.4', t)).not.toBe(bucketKey('5.6.7.8', t));
  });
});

describe('global rate limit IP extraction', () => {
  it('uses x-forwarded-for first IP when present', () => {
    expect(extractIp({ headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' } })).toBe('203.0.113.1');
  });

  it('falls back to req.ip when no forwarded header', () => {
    expect(extractIp({ ip: '1.1.1.1', headers: {} })).toBe('1.1.1.1');
  });

  it('handles array forwarded header', () => {
    expect(extractIp({ headers: { 'x-forwarded-for': ['9.9.9.9', '8.8.8.8'] } })).toBe('9.9.9.9');
  });

  it('returns "unknown" when nothing is available', () => {
    expect(extractIp({ headers: {} })).toBe('unknown');
  });
});

describe('authed vs anonymous limit selection', () => {
  it('uses authed limit when Authorization header is present', () => {
    expect(pickLimit({ authorization: 'Bearer x' }, 300, 1200)).toBe(1200);
  });

  it('uses anonymous limit otherwise', () => {
    expect(pickLimit({}, 300, 1200)).toBe(300);
  });
});
