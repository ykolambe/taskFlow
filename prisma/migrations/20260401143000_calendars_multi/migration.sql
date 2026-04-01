CREATE TYPE "CalendarType" AS ENUM ('ORG', 'PERSONAL');
CREATE TYPE "CalendarEntryKind" AS ENUM ('GOAL', 'MILESTONE');

CREATE TABLE "calendar_collections" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#22c55e',
  "type" "CalendarType" NOT NULL DEFAULT 'PERSONAL',
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_entries" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "calendarId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "kind" "CalendarEntryKind" NOT NULL DEFAULT 'GOAL',
  "color" TEXT NOT NULL DEFAULT '#22c55e',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "isDone" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calendar_collections_companyId_type_isArchived_idx" ON "calendar_collections"("companyId", "type", "isArchived");
CREATE INDEX "calendar_collections_ownerUserId_isArchived_idx" ON "calendar_collections"("ownerUserId", "isArchived");
CREATE INDEX "calendar_entries_companyId_startAt_idx" ON "calendar_entries"("companyId", "startAt");
CREATE INDEX "calendar_entries_calendarId_startAt_idx" ON "calendar_entries"("calendarId", "startAt");

ALTER TABLE "calendar_collections" ADD CONSTRAINT "calendar_collections_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_collections" ADD CONSTRAINT "calendar_collections_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendar_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
