-- User model fields added for add-ons and AI (see schema.prisma).
-- Safe to re-run on Postgres: IF NOT EXISTS skips existing columns.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isTenantBootstrapAccount" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aiLeaderQaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "chatAddonAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "recurringAddonAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aiAddonAccess" BOOLEAN NOT NULL DEFAULT false;
