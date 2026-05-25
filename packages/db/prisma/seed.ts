import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_BOOTSTRAP_EMAIL ?? 'admin@diyaa.ai';
  const password = process.env.SUPERADMIN_BOOTSTRAP_PASSWORD ?? 'change-me-on-first-boot';

  const existing = await prisma.superAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log(`SuperAdmin already exists: ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.superAdmin.create({ data: { email, password: hash } });
  console.log(`SuperAdmin seeded: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
