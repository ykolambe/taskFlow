-- Drop unique (companyId, level) so multiple roles can share the same hierarchy number (e.g. CEO + CTO at level 2)
ALTER TABLE "role_levels" DROP CONSTRAINT IF EXISTS "role_levels_companyId_level_key";

-- CreateTable
CREATE TABLE "company_hierarchy_tiers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "defaultAiAddon" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "company_hierarchy_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_hierarchy_tiers_companyId_level_key" ON "company_hierarchy_tiers"("companyId", "level");

-- AddForeignKey
ALTER TABLE "company_hierarchy_tiers" ADD CONSTRAINT "company_hierarchy_tiers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default chat + recurring on for everyone (existing rows)
UPDATE "users" SET "chatAddonAccess" = true, "recurringAddonAccess" = true WHERE "chatAddonAccess" = false OR "recurringAddonAccess" = false;

-- AlterColumn defaults for new users
ALTER TABLE "users" ALTER COLUMN "chatAddonAccess" SET DEFAULT true;
ALTER TABLE "users" ALTER COLUMN "recurringAddonAccess" SET DEFAULT true;

CREATE INDEX IF NOT EXISTS "role_levels_companyId_level_idx" ON "role_levels"("companyId", "level");
