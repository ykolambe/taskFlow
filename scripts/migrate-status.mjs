/**
 * Migration script:
 * 1. Convert tasks.status from enum → varchar (preserves existing "TODO" etc. values)
 * 2. Drop the old TaskStatus enum from PostgreSQL
 * 3. Create default TaskStatusConfig rows for every existing company
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_STATUSES = [
  { key: "TODO",             label: "To Do",            color: "#64748b", order: 1, type: "OPEN"   },
  { key: "IN_PROGRESS",      label: "In Progress",      color: "#3b82f6", order: 2, type: "ACTIVE" },
  { key: "READY_FOR_REVIEW", label: "Ready for Review", color: "#f59e0b", order: 3, type: "REVIEW" },
  { key: "COMPLETED",        label: "Completed",        color: "#10b981", order: 4, type: "DONE"   },
];

async function main() {
  console.log("Step 1: Converting tasks.status from enum to varchar …");
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE tasks ALTER COLUMN status TYPE VARCHAR USING status::VARCHAR`
    );
    console.log("  ✓ Column converted");
  } catch (e) {
    // If it's already varchar this will fail — that's fine
    console.log("  ⚠  Column already varchar (or already migrated):", e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "TaskStatus"`);
    console.log("  ✓ Old TaskStatus enum dropped");
  } catch (e) {
    console.log("  ⚠  Could not drop enum:", e.message);
  }

  console.log("Step 1b: Resetting any NULL status values to 'TODO' …");
  const fixed = await prisma.$executeRawUnsafe(
    `UPDATE tasks SET status = 'TODO' WHERE status IS NULL OR status = ''`
  );
  console.log(`  ✓ Reset ${fixed} rows`);

  console.log("Step 2: Creating default status configs for existing companies …");
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  console.log(`  Found ${companies.length} company/companies`);

  for (const company of companies) {
    for (const s of DEFAULT_STATUSES) {
      await prisma.taskStatusConfig.upsert({
        where: { companyId_key: { companyId: company.id, key: s.key } },
        update: { label: s.label, color: s.color, order: s.order, type: s.type },
        create: { companyId: company.id, ...s },
      });
    }
    console.log(`  ✓ ${company.name}`);
  }

  console.log("Migration complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
