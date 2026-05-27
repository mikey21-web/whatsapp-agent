#!/bin/sh
set -e
cd /app
cat > /app/check.mjs <<'JS'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const convs = await prisma.conversation.findMany({
    include: { contact: true, messages: { orderBy: { createdAt: 'desc' }, take: 5 } },
    orderBy: { lastMessageAt: 'desc' },
    take: 5,
  });
  console.log('CONVERSATIONS:');
  console.log(JSON.stringify(convs, null, 2));
  const recentMsgs = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('\nLATEST MESSAGES:');
  console.log(JSON.stringify(recentMsgs, null, 2));
} finally {
  await prisma.$disconnect();
}
JS
node /app/check.mjs
rm /app/check.mjs
