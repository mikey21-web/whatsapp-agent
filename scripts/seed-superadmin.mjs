// One-off seeder for the superadmin account. Reads creds from
// SUPERADMIN_BOOTSTRAP_EMAIL / SUPERADMIN_BOOTSTRAP_PASSWORD and idempotently
// creates the row if missing. Mirrors packages/db/prisma/seed.ts but is plain
// .mjs so it can run from the repo root without ts-node setup.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const email = process.env.SUPERADMIN_BOOTSTRAP_EMAIL;
const password = process.env.SUPERADMIN_BOOTSTRAP_PASSWORD;
if (!email || !password) {
  console.error('Missing SUPERADMIN_BOOTSTRAP_EMAIL or SUPERADMIN_BOOTSTRAP_PASSWORD');
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const existing = await prisma.superAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log(`SuperAdmin already exists: ${email}`);
  } else {
    const hash = await bcrypt.hash(password, 12);
    await prisma.superAdmin.create({ data: { email, password: hash } });
    console.log(`SuperAdmin seeded: ${email}`);
  }
} finally {
  await prisma.$disconnect();
}
