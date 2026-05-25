import type { AgencyPlan } from '@diyaa/db';

export interface PlanLimits {
  maxClients: number;
  maxNumbersPerClient: number;
  maxMessagesPerMonth: number;
  /** Razorpay plan_id; resolved from env at runtime. */
  razorpayPlanIdEnvKey: 'PLAN_STARTER_PRICE_ID' | 'PLAN_GROWTH_PRICE_ID' | 'PLAN_SCALE_PRICE_ID';
  priceInr: number;
  label: string;
}

export const PLANS: Record<AgencyPlan, PlanLimits> = {
  STARTER: {
    maxClients: 3,
    maxNumbersPerClient: 1,
    maxMessagesPerMonth: 5_000,
    razorpayPlanIdEnvKey: 'PLAN_STARTER_PRICE_ID',
    priceInr: 2999,
    label: 'Starter',
  },
  GROWTH: {
    maxClients: 15,
    maxNumbersPerClient: 3,
    maxMessagesPerMonth: 25_000,
    razorpayPlanIdEnvKey: 'PLAN_GROWTH_PRICE_ID',
    priceInr: 6999,
    label: 'Growth',
  },
  SCALE: {
    maxClients: Number.MAX_SAFE_INTEGER,
    maxNumbersPerClient: Number.MAX_SAFE_INTEGER,
    maxMessagesPerMonth: Number.MAX_SAFE_INTEGER,
    razorpayPlanIdEnvKey: 'PLAN_SCALE_PRICE_ID',
    priceInr: 14999,
    label: 'Scale',
  },
};
