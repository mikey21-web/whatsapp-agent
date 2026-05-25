-- WhatsappProvider enum
CREATE TYPE "WhatsappProvider" AS ENUM ('EVOLUTION', 'META_CLOUD');

-- Provider + Cloud API + guardrail columns on WhatsappAccount
ALTER TABLE "WhatsappAccount"
  ADD COLUMN "provider" "WhatsappProvider" NOT NULL DEFAULT 'EVOLUTION',
  ADD COLUMN "wabaId" TEXT,
  ADD COLUMN "phoneNumberId" TEXT,
  ADD COLUMN "accessTokenEnc" TEXT,
  ADD COLUMN "qualityRating" TEXT,
  ADD COLUMN "messagingTier" TEXT,
  ADD COLUMN "msgsPerMinute" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "msgsPerDay" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "warmupMode" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "outboundPaused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "WhatsappAccount_phoneNumberId_key" ON "WhatsappAccount"("phoneNumberId");

-- Templates
CREATE TABLE "WhatsappTemplate" (
  "id" TEXT NOT NULL,
  "whatsappAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "components" JSONB NOT NULL,
  "metaTemplateId" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsappTemplate_whatsappAccountId_name_language_key"
  ON "WhatsappTemplate"("whatsappAccountId", "name", "language");
CREATE INDEX "WhatsappTemplate_whatsappAccountId_status_idx"
  ON "WhatsappTemplate"("whatsappAccountId", "status");
ALTER TABLE "WhatsappTemplate" ADD CONSTRAINT "WhatsappTemplate_whatsappAccountId_fkey"
  FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsappAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quality / telemetry events
CREATE TABLE "WhatsappQualityEvent" (
  "id" TEXT NOT NULL,
  "whatsappAccountId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappQualityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WhatsappQualityEvent_whatsappAccountId_createdAt_idx"
  ON "WhatsappQualityEvent"("whatsappAccountId", "createdAt");
ALTER TABLE "WhatsappQualityEvent" ADD CONSTRAINT "WhatsappQualityEvent_whatsappAccountId_fkey"
  FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsappAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
