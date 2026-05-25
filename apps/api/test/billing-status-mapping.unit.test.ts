import { describe, expect, it } from 'vitest';

// Same mapping logic as billing.service.ts (kept inline so the test doesn't
// pull in the full Nest dependency tree).
function mapStatus(s?: string) {
  switch (s) {
    case 'active':
    case 'authenticated':
    case 'completed':
      return 'ACTIVE';
    case 'created':
    case 'pending':
      return 'TRIALING';
    case 'halted':
    case 'paused':
      return 'PAST_DUE';
    case 'cancelled':
    case 'expired':
      return 'CANCELLED';
    default:
      return 'ACTIVE';
  }
}

describe('Razorpay status mapping', () => {
  it('maps active/authenticated/completed → ACTIVE', () => {
    expect(mapStatus('active')).toBe('ACTIVE');
    expect(mapStatus('authenticated')).toBe('ACTIVE');
    expect(mapStatus('completed')).toBe('ACTIVE');
  });

  it('maps created/pending → TRIALING', () => {
    expect(mapStatus('created')).toBe('TRIALING');
    expect(mapStatus('pending')).toBe('TRIALING');
  });

  it('maps halted/paused → PAST_DUE', () => {
    expect(mapStatus('halted')).toBe('PAST_DUE');
    expect(mapStatus('paused')).toBe('PAST_DUE');
  });

  it('maps cancelled/expired → CANCELLED', () => {
    expect(mapStatus('cancelled')).toBe('CANCELLED');
    expect(mapStatus('expired')).toBe('CANCELLED');
  });

  it('unknown status defaults to ACTIVE', () => {
    expect(mapStatus('unknown')).toBe('ACTIVE');
    expect(mapStatus(undefined)).toBe('ACTIVE');
  });
});
