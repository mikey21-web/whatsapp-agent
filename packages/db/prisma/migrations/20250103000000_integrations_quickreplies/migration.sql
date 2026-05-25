CREATE TYPE "IntegrationKind" AS ENUM ('SHOPIFY', 'ZOHO', 'GOOGLE_CALENDAR', 'TALLY');

CREATE TABLE "Integration" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "provider" "IntegrationKind" NOT NULL,
  "credentials" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Integration_clientId_provider_key" ON "Integration"("clientId", "provider");
CREATE INDEX "Integration_clientId_idx" ON "Integration"("clientId");
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuickReply" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "shortcut" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuickReply_clientId_shortcut_key" ON "QuickReply"("clientId", "shortcut");
CREATE INDEX "QuickReply_clientId_idx" ON "QuickReply"("clientId");
ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
