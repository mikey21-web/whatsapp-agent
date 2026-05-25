import { describe, expect, it } from 'vitest';

/**
 * Logic-level checks for the embedded-signup token validation flow.
 * The HTTP handshake is integration territory; here we confirm the
 * authorization decision rules.
 */

interface DebugTokenResponse {
  data?: {
    is_valid?: boolean;
    granular_scopes?: { scope: string; target_ids?: string[] }[];
    expires_at?: number;
  };
}

function decideAccess(args: {
  debug: DebugTokenResponse;
  requestedWaba: string;
}): { allow: boolean; reason: string } {
  if (!args.debug.data?.is_valid) return { allow: false, reason: 'token_invalid' };
  const granted = (args.debug.data.granular_scopes ?? [])
    .filter((s) =>
      s.scope === 'whatsapp_business_management' || s.scope === 'whatsapp_business_messaging',
    )
    .flatMap((s) => s.target_ids ?? []);
  if (granted.length > 0 && !granted.includes(args.requestedWaba)) {
    return { allow: false, reason: 'waba_not_granted' };
  }
  return { allow: true, reason: 'ok' };
}

describe('embedded signup access decision', () => {
  it('rejects invalid token', () => {
    expect(decideAccess({
      debug: { data: { is_valid: false } },
      requestedWaba: 'w_1',
    }).reason).toBe('token_invalid');
  });

  it('rejects missing data envelope', () => {
    expect(decideAccess({ debug: {}, requestedWaba: 'w_1' }).allow).toBe(false);
  });

  it('rejects WABA not in granted scope', () => {
    const debug: DebugTokenResponse = {
      data: {
        is_valid: true,
        granular_scopes: [
          { scope: 'whatsapp_business_management', target_ids: ['w_a', 'w_b'] },
          { scope: 'whatsapp_business_messaging', target_ids: ['w_a'] },
        ],
      },
    };
    expect(decideAccess({ debug, requestedWaba: 'w_attacker' }).reason).toBe('waba_not_granted');
  });

  it('allows when requested WABA is in management scope', () => {
    const debug: DebugTokenResponse = {
      data: {
        is_valid: true,
        granular_scopes: [
          { scope: 'whatsapp_business_management', target_ids: ['w_a'] },
        ],
      },
    };
    expect(decideAccess({ debug, requestedWaba: 'w_a' }).allow).toBe(true);
  });

  it('allows when no granular scopes are present (legacy tokens)', () => {
    const debug: DebugTokenResponse = {
      data: { is_valid: true },
    };
    expect(decideAccess({ debug, requestedWaba: 'w_a' }).allow).toBe(true);
  });

  it('ignores unrelated scope target ids', () => {
    const debug: DebugTokenResponse = {
      data: {
        is_valid: true,
        granular_scopes: [
          { scope: 'pages_show_list', target_ids: ['p_1'] },
          { scope: 'whatsapp_business_management', target_ids: ['w_a'] },
        ],
      },
    };
    expect(decideAccess({ debug, requestedWaba: 'w_a' }).allow).toBe(true);
  });
});
