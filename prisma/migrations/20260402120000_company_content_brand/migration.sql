-- Content Studio: optional brand context for AI (website fetch + brief + competitors)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "contentBrandBrief" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "contentBrandWebsite" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "contentBrandCompetitorNotes" TEXT;
