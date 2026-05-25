import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(Number(process.env.PORT ?? 3001)),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  WEB_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  WEBHOOK_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3001'),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).default(process.env.DATABASE_URL ?? ''),
  REDIS_URL: z.string().min(1),

  // ── Auth ──
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL: z.string().default('7d'),

  ENCRYPTION_KEY: z.string().min(32),

  ALLOW_AGENCY_SIGNUP: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  /// Global per-IP request cap (anonymous traffic).
  GLOBAL_RATE_LIMIT_PER_MIN: z.coerce.number().int().nonnegative().default(300),
  /// Global per-IP request cap when an Authorization header is present.
  GLOBAL_RATE_LIMIT_AUTHED_PER_MIN: z.coerce.number().int().nonnegative().default(1200),

  // ── Evolution API (legacy unofficial provider) ──
  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),

  // ── Meta WhatsApp Cloud API (official) ──
  META_APP_ID: z.string().optional().default(''),
  META_APP_SECRET: z.string().optional().default(''),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(''),
  META_EMBEDDED_SIGNUP_CONFIG_ID: z.string().optional().default(''),
  META_EMBEDDED_SIGNUP_REDIRECT_URI: z.string().optional().default(''),
  /// Optional: a platform-wide system user token. If unset, we use per-account
  /// tokens stored encrypted on WhatsappAccount.accessTokenEnc.
  META_SYSTEM_USER_TOKEN: z.string().optional().default(''),

  // ── AI ──
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  OPENAI_API_KEY: z.string().optional().default(''),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  SARVAM_API_KEY: z.string().optional().default(''),

  // ── Email ──
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('noreply@diyaa.ai'),

  // ── Billing ──
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  PLAN_STARTER_PRICE_ID: z.string().optional().default(''),
  PLAN_GROWTH_PRICE_ID: z.string().optional().default(''),
  PLAN_SCALE_PRICE_ID: z.string().optional().default(''),

  // ── Integrations ──
  SHOPIFY_API_KEY: z.string().optional().default(''),
  SHOPIFY_API_SECRET: z.string().optional().default(''),
  SHOPIFY_SCOPES: z.string().default('read_orders,read_customers,read_products'),
  ZOHO_CLIENT_ID: z.string().optional().default(''),
  ZOHO_CLIENT_SECRET: z.string().optional().default(''),
  ZOHO_SCOPES: z.string().default('ZohoCRM.modules.ALL,ZohoCRM.users.READ'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_SCOPES: z
    .string()
    .default('https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
