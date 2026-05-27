-- Add FREE tier to AgencyPlan and switch default from STARTER to FREE.
-- Existing rows with STARTER stay on STARTER.

ALTER TYPE "AgencyPlan" ADD VALUE IF NOT EXISTS 'FREE' BEFORE 'STARTER';

ALTER TABLE "Agency" ALTER COLUMN "plan" SET DEFAULT 'FREE';
