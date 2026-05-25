-- Email verification + MFA columns on Agency
ALTER TABLE "Agency"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Email verification + MFA columns on Client
ALTER TABLE "Client"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Subscription enhancements for Razorpay
ALTER TABLE "Subscription"
  ADD COLUMN "razorpayCustomerId" TEXT,
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "graceUntil" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Subscription_razorpaySubId_key" ON "Subscription"("razorpaySubId");

-- ── EmailToken ──
CREATE TYPE "EmailTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFY');

CREATE TABLE "EmailToken" (
  "id" TEXT NOT NULL,
  "subjectType" "SubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "purpose" "EmailTokenType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailToken_tokenHash_key" ON "EmailToken"("tokenHash");
CREATE INDEX "EmailToken_subjectType_subjectId_purpose_idx"
  ON "EmailToken"("subjectType", "subjectId", "purpose");

-- ── OtpCode ──
CREATE TABLE "OtpCode" (
  "id" TEXT NOT NULL,
  "subjectType" "SubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OtpCode_subjectType_subjectId_idx" ON "OtpCode"("subjectType", "subjectId");

-- ── UsageRecord ──
CREATE TABLE "UsageRecord" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "period" TIMESTAMP(3) NOT NULL,
  "messages" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UsageRecord_agencyId_period_key" ON "UsageRecord"("agencyId", "period");
CREATE INDEX "UsageRecord_agencyId_period_idx" ON "UsageRecord"("agencyId", "period");
ALTER TABLE "UsageRecord"
  ADD CONSTRAINT "UsageRecord_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
