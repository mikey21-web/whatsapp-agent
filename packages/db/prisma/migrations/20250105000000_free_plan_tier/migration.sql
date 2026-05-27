-- Add FREE tier to AgencyPlan. Postgres requires the ALTER TYPE ADD VALUE
-- to commit before the new value can be used in DEFAULT/queries, so changing
-- the column default lives in a separate migration (20250105000001).

ALTER TYPE "AgencyPlan" ADD VALUE IF NOT EXISTS 'FREE' BEFORE 'STARTER';
