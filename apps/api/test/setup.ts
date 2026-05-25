/**
 * Sets safe defaults for env-validated modules so unit tests can import code
 * that pulls in `config/env` without failing the Zod check.
 *
 * Tests that need a live DB / Redis go in `test/integration/` and use the
 * separate `vitest.integration.config.ts`.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/diyaa_test';
process.env.DIRECT_URL ??= 'postgresql://test:test@localhost:5432/diyaa_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-with-at-least-32-chars-please';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-with-at-least-32-chars-please';
process.env.EVOLUTION_API_URL ??= 'https://example.com';
process.env.EVOLUTION_API_KEY ??= 'test-evolution-key';
process.env.ENCRYPTION_KEY ??= 'test-encryption-key-32-chars-or-more!!';
process.env.RAZORPAY_WEBHOOK_SECRET ??= 'test-razorpay-webhook-secret';
process.env.SHOPIFY_API_SECRET ??= 'test-shopify-secret';
process.env.SHOPIFY_API_KEY ??= 'test-shopify-key';
process.env.WEB_PUBLIC_URL ??= 'http://localhost:3000';
process.env.API_PUBLIC_URL ??= 'http://localhost:3001';
process.env.WEBHOOK_PUBLIC_URL ??= 'http://localhost:3001';
