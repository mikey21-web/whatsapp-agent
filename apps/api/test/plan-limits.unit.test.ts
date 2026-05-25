import { describe, expect, it } from 'vitest';
import { PLANS } from '../src/billing/plans';

describe('plan limits config', () => {
  it('has all three plans', () => {
    expect(PLANS.STARTER).toBeDefined();
    expect(PLANS.GROWTH).toBeDefined();
    expect(PLANS.SCALE).toBeDefined();
  });

  it('limits ascend monotonically across tiers', () => {
    expect(PLANS.STARTER.maxClients).toBeLessThan(PLANS.GROWTH.maxClients);
    expect(PLANS.GROWTH.maxClients).toBeLessThan(PLANS.SCALE.maxClients);
    expect(PLANS.STARTER.maxNumbersPerClient).toBeLessThanOrEqual(PLANS.GROWTH.maxNumbersPerClient);
    expect(PLANS.GROWTH.maxNumbersPerClient).toBeLessThanOrEqual(PLANS.SCALE.maxNumbersPerClient);
    expect(PLANS.STARTER.maxMessagesPerMonth).toBeLessThan(PLANS.GROWTH.maxMessagesPerMonth);
    expect(PLANS.GROWTH.maxMessagesPerMonth).toBeLessThan(PLANS.SCALE.maxMessagesPerMonth);
  });

  it('prices ascend monotonically', () => {
    expect(PLANS.STARTER.priceInr).toBeLessThan(PLANS.GROWTH.priceInr);
    expect(PLANS.GROWTH.priceInr).toBeLessThan(PLANS.SCALE.priceInr);
  });

  it('SCALE plan has effectively unlimited quotas', () => {
    expect(PLANS.SCALE.maxClients).toBe(Number.MAX_SAFE_INTEGER);
    expect(PLANS.SCALE.maxNumbersPerClient).toBe(Number.MAX_SAFE_INTEGER);
    expect(PLANS.SCALE.maxMessagesPerMonth).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('each plan references a Razorpay env key', () => {
    for (const tier of ['STARTER', 'GROWTH', 'SCALE'] as const) {
      expect(PLANS[tier].razorpayPlanIdEnvKey).toMatch(/^PLAN_\w+_PRICE_ID$/);
    }
  });
});
