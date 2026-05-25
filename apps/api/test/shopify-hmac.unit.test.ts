import { describe, expect, it } from 'vitest';
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = 'test-shopify-secret';

function verify(query: Record<string, string | undefined>): boolean {
  const provided = query.hmac;
  if (!provided) return false;
  const entries = Object.entries(query)
    .filter(([k, v]) => k !== 'hmac' && k !== 'signature' && v !== undefined)
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const message = entries.map(([k, v]) => `${k}=${v}`).join('&');
  const digest = createHmac('sha256', SECRET).update(message).digest('hex');
  if (digest.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(digest), Buffer.from(provided));
}

function signQuery(params: Record<string, string>): string {
  const entries = Object.entries(params)
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const message = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return createHmac('sha256', SECRET).update(message).digest('hex');
}

describe('Shopify HMAC callback verification', () => {
  it('accepts a correctly signed query', () => {
    const params = { code: 'abc', shop: 'test.myshopify.com', state: 'xyz' };
    const hmac = signQuery(params);
    expect(verify({ ...params, hmac })).toBe(true);
  });

  it('rejects missing hmac', () => {
    expect(verify({ code: 'abc', shop: 'test.myshopify.com' })).toBe(false);
  });

  it('rejects tampered query string', () => {
    const params = { code: 'abc', shop: 'test.myshopify.com', state: 'xyz' };
    const hmac = signQuery(params);
    expect(verify({ ...params, code: 'tampered', hmac })).toBe(false);
  });

  it('ignores signature param when present', () => {
    const params = { code: 'abc', shop: 'test.myshopify.com', state: 'xyz' };
    const hmac = signQuery(params);
    expect(verify({ ...params, hmac, signature: 'should-be-ignored' })).toBe(true);
  });

  it('handles parameters in any order (sorts before signing)', () => {
    const a = signQuery({ a: '1', b: '2', c: '3' });
    const b = signQuery({ c: '3', a: '1', b: '2' });
    expect(a).toBe(b);
  });
});
