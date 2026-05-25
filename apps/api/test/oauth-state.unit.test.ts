import { describe, expect, it } from 'vitest';
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = 'test-state-secret';

interface OauthState {
  clientId: string;
  kind: string;
  shop?: string;
  expiresAt: number;
}

function sign(state: OauthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(state: string): OauthState | null {
  try {
    const [payload, sig] = state.split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as OauthState;
    if (decoded.expiresAt < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

describe('OAuth signed state', () => {
  it('round-trips a valid state', () => {
    const original: OauthState = {
      clientId: 'client_123',
      kind: 'GOOGLE_CALENDAR',
      expiresAt: Date.now() + 60_000,
    };
    const signed = sign(original);
    const decoded = verify(signed);
    expect(decoded).not.toBeNull();
    expect(decoded?.clientId).toBe('client_123');
    expect(decoded?.kind).toBe('GOOGLE_CALENDAR');
  });

  it('rejects expired state', () => {
    const expired: OauthState = {
      clientId: 'c',
      kind: 'SHOPIFY',
      expiresAt: Date.now() - 1000,
    };
    expect(verify(sign(expired))).toBeNull();
  });

  it('rejects tampered payload', () => {
    const original: OauthState = {
      clientId: 'c',
      kind: 'SHOPIFY',
      expiresAt: Date.now() + 60_000,
    };
    const signed = sign(original);
    const [payload, sig] = signed.split('.');
    // Tamper the payload but keep the original signature.
    const tampered = Buffer.from(JSON.stringify({ ...original, clientId: 'attacker' })).toString('base64url');
    expect(verify(`${tampered}.${sig}`)).toBeNull();
  });

  it('rejects malformed state', () => {
    expect(verify('garbage')).toBeNull();
    expect(verify('a.b.c')).toBeNull();
    expect(verify('')).toBeNull();
  });

  it('rejects state with mismatched signature length', () => {
    const original: OauthState = { clientId: 'c', kind: 'ZOHO', expiresAt: Date.now() + 60_000 };
    const [payload] = sign(original).split('.');
    expect(verify(`${payload}.short`)).toBeNull();
  });
});
