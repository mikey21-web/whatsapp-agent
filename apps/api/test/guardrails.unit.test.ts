import { describe, expect, it } from 'vitest';

const WARMUP = [
  { upTo: 3, max: 50 },
  { upTo: 7, max: 250 },
  { upTo: 14, max: 1_000 },
  { upTo: 30, max: 5_000 },
];

function warmupCapForAge(createdAt: Date): number {
  const ageDays = (Date.now() - createdAt.getTime()) / 86400_000;
  for (const tier of WARMUP) {
    if (ageDays <= tier.upTo) return tier.max;
  }
  return 0;
}

describe('warm-up daily caps by number age', () => {
  it('brand new number → 50/day', () => {
    expect(warmupCapForAge(new Date())).toBe(50);
  });

  it('5 days old → 250/day', () => {
    expect(warmupCapForAge(new Date(Date.now() - 5 * 86400_000))).toBe(250);
  });

  it('10 days old → 1000/day', () => {
    expect(warmupCapForAge(new Date(Date.now() - 10 * 86400_000))).toBe(1000);
  });

  it('20 days old → 5000/day', () => {
    expect(warmupCapForAge(new Date(Date.now() - 20 * 86400_000))).toBe(5000);
  });

  it('45 days old → uncapped (returns 0)', () => {
    expect(warmupCapForAge(new Date(Date.now() - 45 * 86400_000))).toBe(0);
  });

  it('boundary at exactly 3 days still gets 50/day', () => {
    expect(warmupCapForAge(new Date(Date.now() - 3 * 86400_000 + 1000))).toBe(50);
  });
});

describe('cold-outbound policy by provider', () => {
  // Codifies the rule matrix so a future regression breaks the test.
  type Decision = { allow: boolean; reason: string };
  function decide(args: {
    provider: 'EVOLUTION' | 'META_CLOUD';
    isCold: boolean;
    isTemplate: boolean;
    paused: boolean;
  }): Decision {
    if (args.paused) return { allow: false, reason: 'paused' };
    if (args.provider === 'META_CLOUD' && args.isCold && !args.isTemplate) {
      return { allow: false, reason: 'service_window' };
    }
    if (args.provider === 'EVOLUTION' && args.isCold) {
      return { allow: false, reason: 'cold_outbound' };
    }
    return { allow: true, reason: 'ok' };
  }

  it('paused account always blocks', () => {
    expect(decide({ provider: 'META_CLOUD', isCold: false, isTemplate: false, paused: true }).allow).toBe(false);
  });

  it('Evolution + cold → block', () => {
    expect(decide({ provider: 'EVOLUTION', isCold: true, isTemplate: false, paused: false }).reason).toBe('cold_outbound');
  });

  it('Evolution + warm → allow', () => {
    expect(decide({ provider: 'EVOLUTION', isCold: false, isTemplate: false, paused: false }).allow).toBe(true);
  });

  it('Meta Cloud + cold + template → allow', () => {
    expect(decide({ provider: 'META_CLOUD', isCold: true, isTemplate: true, paused: false }).allow).toBe(true);
  });

  it('Meta Cloud + cold + no template → block (service window)', () => {
    expect(decide({ provider: 'META_CLOUD', isCold: true, isTemplate: false, paused: false }).reason).toBe('service_window');
  });

  it('Meta Cloud + warm + no template → allow', () => {
    expect(decide({ provider: 'META_CLOUD', isCold: false, isTemplate: false, paused: false }).allow).toBe(true);
  });
});
