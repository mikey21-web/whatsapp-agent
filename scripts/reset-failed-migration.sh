#!/bin/sh
# Manually reset the failed migration row in _prisma_migrations so the next
# `prisma migrate deploy` can re-apply (after the SQL has been fixed).
set -e
cd /app
cat > /app/reset.mjs <<'JS'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  // Mark all unfinished migrations with the old name as rolled back.
  const r = await prisma.$executeRawUnsafe(
    "DELETE FROM _prisma_migrations WHERE migration_name = '20250105000000_free_plan_tier' AND finished_at IS NULL"
  );
  console.log('Deleted failed migration rows: ' + r);
} finally {
  await prisma.$disconnect();
}
JS
node /app/reset.mjs
rm /app/reset.mjs
