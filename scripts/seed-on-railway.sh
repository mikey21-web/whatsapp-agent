#!/bin/sh
# Run inside the Railway container via `railway ssh ... < this file`.
# Required env vars (exported by the caller):
#   SUPERADMIN_BOOTSTRAP_EMAIL, SUPERADMIN_BOOTSTRAP_PASSWORD
#   AGENCY_EMAIL, AGENCY_PASSWORD, AGENCY_NAME, AGENCY_SLUG
#   CLIENT_EMAIL, CLIENT_PASSWORD, CLIENT_NAME, CLIENT_BUSINESS
#   WA_PHONE_NUMBER_ID, WA_WABA_ID, WA_PHONE, WA_DISPLAY, WA_TOKEN
#   ENCRYPTION_KEY (already in container env)
set -e
cd /app
cat > /app/seed.mjs <<'JS'
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

function encryptJson(payload, secret) {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${data.toString('base64url')}`;
}

const prisma = new PrismaClient();
try {
  // 1. SuperAdmin
  const saEmail = process.env.SUPERADMIN_BOOTSTRAP_EMAIL;
  const saPwd = process.env.SUPERADMIN_BOOTSTRAP_PASSWORD;
  if (saEmail && saPwd) {
    const ex = await prisma.superAdmin.findUnique({ where: { email: saEmail } });
    if (!ex) {
      await prisma.superAdmin.create({ data: { email: saEmail, password: await bcrypt.hash(saPwd, 12) } });
      console.log('SuperAdmin seeded: ' + saEmail);
    } else {
      console.log('SuperAdmin exists: ' + saEmail);
    }
  }

  // 2. Agency
  const agEmail = process.env.AGENCY_EMAIL;
  const agPwd = process.env.AGENCY_PASSWORD;
  const agName = process.env.AGENCY_NAME;
  const agSlug = process.env.AGENCY_SLUG;
  let agency = await prisma.agency.findUnique({ where: { email: agEmail } });
  if (!agency) {
    agency = await prisma.agency.create({
      data: {
        email: agEmail,
        password: await bcrypt.hash(agPwd, 12),
        name: agName,
        slug: agSlug,
        emailVerifiedAt: new Date(),
      },
    });
    console.log('Agency created: ' + agency.id);
  } else {
    console.log('Agency exists: ' + agency.id);
  }

  // 3. Client
  const clEmail = process.env.CLIENT_EMAIL;
  const clPwd = process.env.CLIENT_PASSWORD;
  const clName = process.env.CLIENT_NAME;
  const clBiz = process.env.CLIENT_BUSINESS;
  let client = await prisma.client.findUnique({ where: { email: clEmail } });
  if (!client) {
    client = await prisma.client.create({
      data: {
        agencyId: agency.id,
        email: clEmail,
        password: await bcrypt.hash(clPwd, 12),
        name: clName,
        businessName: clBiz,
        emailVerifiedAt: new Date(),
      },
    });
    console.log('Client created: ' + client.id);
  } else {
    console.log('Client exists: ' + client.id);
  }

  // 4. WhatsApp Account (Meta Cloud)
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const wabaId = process.env.WA_WABA_ID;
  const phone = process.env.WA_PHONE;
  const display = process.env.WA_DISPLAY;
  const token = process.env.WA_TOKEN;
  const encKey = process.env.ENCRYPTION_KEY;
  if (!encKey) throw new Error('ENCRYPTION_KEY not in container env');
  const tokenEnc = encryptJson({ token }, encKey);
  const existingAcct = await prisma.whatsappAccount.findUnique({ where: { phoneNumberId: phoneId } });
  if (!existingAcct) {
    const acct = await prisma.whatsappAccount.create({
      data: {
        clientId: client.id,
        provider: 'META_CLOUD',
        instanceName: `meta-${phoneId}`,
        phoneNumber: phone,
        displayName: display,
        isConnected: true,
        wabaId,
        phoneNumberId: phoneId,
        accessTokenEnc: tokenEnc,
      },
    });
    console.log('WhatsAppAccount created: ' + acct.id);
  } else {
    await prisma.whatsappAccount.update({
      where: { id: existingAcct.id },
      data: { accessTokenEnc: tokenEnc, isConnected: true, wabaId, displayName: display, phoneNumber: phone },
    });
    console.log('WhatsAppAccount updated: ' + existingAcct.id);
  }
} finally {
  await prisma.$disconnect();
}
JS
node /app/seed.mjs
rm /app/seed.mjs
