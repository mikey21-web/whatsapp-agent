import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integration test against a live API. Run separately from unit tests:
 *   pnpm exec vitest run test/integration --no-file-parallelism
 *
 * Requires DATABASE_URL, REDIS_URL, JWT_*_SECRET, EVOLUTION_API_URL,
 * EVOLUTION_API_KEY in the environment, and the schema must already be
 * migrated (`pnpm --filter @diyaa/db prisma:deploy`).
 */
const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'EVOLUTION_API_URL',
  'EVOLUTION_API_KEY',
];
const hasEnv = required.every((k) => !!process.env[k]);
const d = hasEnv ? describe : describe.skip;

d('auth integration', () => {
  let app: any;
  let prisma: any;
  let request: any;
  const email = `super-${Date.now()}@diyaa.test`;
  const password = 'super-secret-pass-1234';

  beforeAll(async () => {
    const { Test } = await import('@nestjs/testing');
    const { ValidationPipe } = await import('@nestjs/common');
    const supertest = await import('supertest');
    request = supertest.default;
    const bcrypt = await import('bcrypt');
    const { AppModule } = await import('../../src/app.module');
    const { HttpExceptionFilter } = await import('../../src/common/http-exception.filter');
    const { PrismaService } = await import('../../src/prisma/prisma.service');

    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.superAdmin.create({
      data: { email, password: await bcrypt.hash(password, 10) },
    });
  }, 30_000);

  afterAll(async () => {
    if (prisma) await prisma.superAdmin.deleteMany({ where: { email } }).catch(() => undefined);
    if (app) await app.close();
  });

  it('rejects bad credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/superadmin/login')
      .send({ email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns access token on valid login', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/superadmin/login')
      .send({ email, password });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('access token authorises /auth/me', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/superadmin/login')
      .send({ email, password });
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.type).toBe('SUPER_ADMIN');
  });
});
