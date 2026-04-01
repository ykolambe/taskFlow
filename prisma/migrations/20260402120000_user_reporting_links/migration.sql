-- CreateTable
CREATE TABLE "user_reporting_links" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subordinateId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reporting_links_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (before data backfill)
ALTER TABLE "user_reporting_links" ADD CONSTRAINT "user_reporting_links_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_reporting_links" ADD CONSTRAINT "user_reporting_links_subordinateId_fkey" FOREIGN KEY ("subordinateId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_reporting_links" ADD CONSTRAINT "user_reporting_links_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "user_reporting_links_subordinateId_managerId_key" ON "user_reporting_links"("subordinateId", "managerId");

CREATE INDEX "user_reporting_links_companyId_managerId_idx" ON "user_reporting_links"("companyId", "managerId");

CREATE INDEX "user_reporting_links_companyId_subordinateId_idx" ON "user_reporting_links"("companyId", "subordinateId");

-- Backfill from legacy users.parentId when present, then drop column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'parentId'
  ) THEN
    INSERT INTO "user_reporting_links" ("id", "companyId", "subordinateId", "managerId", "sortOrder", "createdAt", "updatedAt")
    SELECT
      'mig_' || replace(gen_random_uuid()::text, '-', ''),
      u."companyId",
      u."id",
      u."parentId",
      0,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM "users" u
    WHERE u."parentId" IS NOT NULL;

    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_parentId_fkey";
    ALTER TABLE "users" DROP COLUMN "parentId";
  END IF;
END $$;
