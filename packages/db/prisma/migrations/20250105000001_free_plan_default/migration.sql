-- Switch the Agency.plan default to FREE now that the enum value is committed.
ALTER TABLE "Agency" ALTER COLUMN "plan" SET DEFAULT 'FREE';
