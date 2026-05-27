import type { AgencyPlan } from '@diyaa/db';

export interface PlanLimits {
  maxClients: number;
  maxNumbersPerClient: number;
  maxMessagesPerMonth: number;
  maxAgents: number;
  maxContacts: number;
  /** Razorpay plan_id env key. FREE has none. */
  razorpayPlanIdEnvKey:
    | 'PLAN_STARTER_PRICE_ID'
    | 'PLAN_GROWTH_PRICE_ID'
    | 'PLAN_SCALE_PRICE_ID'
    | null;
  priceInr: number;
  label: string;
  /** Bullet-point summary for marketing copy. Plain strings, no HTML. */
  highlights: string[];
}

export const PLANS: Record<AgencyPlan, PlanLimits> = {
  FREE: {
    maxClients: 1,
    maxNumbersPerClient: 1,
    maxMessagesPerMonth: 500,
    maxAgents: 1,
    maxContacts: 100,
    razorpayPlanIdEnvKey: null,
    priceInr: 0,
    label: 'Free',
    highlights: [
      '1 WhatsApp number',
      '500 messages / month',
      '100 contacts',
      '1 AI agent',
      'No credit card required',
    ],
  },
  STARTER: {
    maxClients: 1,
    maxNumbersPerClient: 1,
    maxMessagesPerMonth: 5_000,
    maxAgents: 3,
    maxContacts: 2_500,
    razorpayPlanIdEnvKey: 'PLAN_STARTER_PRICE_ID',
    priceInr: 999,
    label: 'Starter',
    highlights: [
      '1 WhatsApp number',
      '5,000 messages / month',
      '2,500 contacts',
      '3 AI agents',
      'Campaigns & broadcasts',
    ],
  },
  GROWTH: {
    maxClients: 1,
    maxNumbersPerClient: 3,
    maxMessagesPerMonth: 25_000,
    maxAgents: 10,
    maxContacts: 25_000,
    razorpayPlanIdEnvKey: 'PLAN_GROWTH_PRICE_ID',
    priceInr: 2999,
    label: 'Growth',
    highlights: [
      '3 WhatsApp numbers',
      '25,000 messages / month',
      '25,000 contacts',
      '10 AI agents',
      'Visual flow builder',
      'CRM & deal pipeline',
    ],
  },
  SCALE: {
    maxClients: 1,
    maxNumbersPerClient: Number.MAX_SAFE_INTEGER,
    maxMessagesPerMonth: Number.MAX_SAFE_INTEGER,
    maxAgents: Number.MAX_SAFE_INTEGER,
    maxContacts: Number.MAX_SAFE_INTEGER,
    razorpayPlanIdEnvKey: 'PLAN_SCALE_PRICE_ID',
    priceInr: 6999,
    label: 'Scale',
    highlights: [
      'Unlimited WhatsApp numbers',
      'Unlimited messages',
      'Unlimited contacts',
      'Unlimited AI agents',
      'Priority support',
      'Custom integrations',
    ],
  },
};

/**
 * Stable order for plan rendering on the marketing site (low → high).
 * UI surfaces should iterate this rather than Object.keys to ensure consistency.
 */
export const PLAN_ORDER: AgencyPlan[] = ['FREE', 'STARTER', 'GROWTH', 'SCALE'];
