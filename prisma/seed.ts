import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Platform Owner ───────────────────────────────────────────────
  const platformEmail = process.env.PLATFORM_EMAIL || "admin@platform.com";
  const platformPassword = process.env.PLATFORM_PASSWORD || "Platform@123";
  const platformName = process.env.PLATFORM_NAME || "Platform Admin";

  const existingPlatform = await prisma.platformOwner.findUnique({
    where: { email: platformEmail },
  });

  if (!existingPlatform) {
    await prisma.platformOwner.create({
      data: {
        email: platformEmail,
        passwordHash: await bcrypt.hash(platformPassword, 12),
        name: platformName,
      },
    });
    console.log(`✅ Platform owner created: ${platformEmail}`);
  } else {
    console.log(`ℹ️  Platform owner already exists: ${platformEmail}`);
  }

  // ─── Demo Company: Acme Corp ──────────────────────────────────────
  const existingCompany = await prisma.company.findUnique({
    where: { slug: "acme" },
  });

  if (!existingCompany) {
    const company = await prisma.company.create({
      data: {
        name: "Acme Corp",
        slug: "acme",
        isActive: true,
        modules: ["tasks", "team", "org", "approvals", "chat"],
      },
    });

    // Role levels (1 = top, 4 = bottom)
    const ceoLevel = await prisma.roleLevel.create({
      data: { companyId: company.id, name: "CEO", level: 1, color: "#8b5cf6" },
    });
    const managerLevel = await prisma.roleLevel.create({
      data: { companyId: company.id, name: "Manager", level: 2, color: "#6366f1" },
    });
    const supervisorLevel = await prisma.roleLevel.create({
      data: { companyId: company.id, name: "Supervisor", level: 3, color: "#3b82f6" },
    });
    const memberLevel = await prisma.roleLevel.create({
      data: { companyId: company.id, name: "Team Member", level: 4, color: "#10b981", canApprove: false },
    });

    // Super Admin (CEO)
    const superAdmin = await prisma.user.create({
      data: {
        companyId: company.id,
        roleLevelId: ceoLevel.id,
        email: "admin@acme.com",
        username: "admin",
        passwordHash: await bcrypt.hash("Admin@123", 12),
        firstName: "Sarah",
        lastName: "Chen",
        isSuperAdmin: true,
        isTenantBootstrapAccount: true,
      },
    });

    // Manager
    const manager = await prisma.user.create({
      data: {
        companyId: company.id,
        roleLevelId: managerLevel.id,
        email: "manager@acme.com",
        username: "jsmith",
        passwordHash: await bcrypt.hash("Manager@123", 12),
        firstName: "James",
        lastName: "Smith",
      },
    });
    await prisma.userReportingLink.create({
      data: {
        companyId: company.id,
        subordinateId: manager.id,
        managerId: superAdmin.id,
        sortOrder: 0,
      },
    });

    // Supervisors
    const supervisor1 = await prisma.user.create({
      data: {
        companyId: company.id,
        roleLevelId: supervisorLevel.id,
        email: "alex@acme.com",
        username: "alex",
        passwordHash: await bcrypt.hash("Alex@123", 12),
        firstName: "Alex",
        lastName: "Johnson",
      },
    });
    await prisma.userReportingLink.create({
      data: { companyId: company.id, subordinateId: supervisor1.id, managerId: manager.id, sortOrder: 0 },
    });

    const supervisor2 = await prisma.user.create({
      data: {
        companyId: company.id,
        roleLevelId: supervisorLevel.id,
        email: "maria@acme.com",
        username: "maria",
        passwordHash: await bcrypt.hash("Maria@123", 12),
        firstName: "Maria",
        lastName: "Garcia",
      },
    });
    await prisma.userReportingLink.create({
      data: { companyId: company.id, subordinateId: supervisor2.id, managerId: manager.id, sortOrder: 0 },
    });

    // Team Members
    const tom = await prisma.user.create({
      data: {
        companyId: company.id,
        roleLevelId: memberLevel.id,
        email: "tom@acme.com",
        username: "tom",
        passwordHash: await bcrypt.hash("Tom@123", 12),
        firstName: "Tom",
        lastName: "Brown",
      },
    });
    await prisma.userReportingLink.create({
      data: { companyId: company.id, subordinateId: tom.id, managerId: supervisor1.id, sortOrder: 0 },
    });

    const lisa = await prisma.user.create({
      data: {
        companyId: company.id,
        roleLevelId: memberLevel.id,
        email: "lisa@acme.com",
        username: "lisa",
        passwordHash: await bcrypt.hash("Lisa@123", 12),
        firstName: "Lisa",
        lastName: "Davis",
      },
    });
    await prisma.userReportingLink.create({
      data: { companyId: company.id, subordinateId: lisa.id, managerId: supervisor1.id, sortOrder: 0 },
    });

    const mike = await prisma.user.create({
      data: {
        companyId: company.id,
        roleLevelId: memberLevel.id,
        email: "mike@acme.com",
        username: "mike",
        passwordHash: await bcrypt.hash("Mike@123", 12),
        firstName: "Mike",
        lastName: "Wilson",
      },
    });
    await prisma.userReportingLink.create({
      data: { companyId: company.id, subordinateId: mike.id, managerId: supervisor2.id, sortOrder: 0 },
    });

    // Sample tasks
    await prisma.task.createMany({
      data: [
        {
          companyId: company.id,
          creatorId: superAdmin.id,
          assigneeId: manager.id,
          title: "Prepare Q2 strategy presentation",
          description: "Create slides for the board meeting covering Q2 goals and KPIs.",
          status: "IN_PROGRESS",
          priority: "HIGH",
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          companyId: company.id,
          creatorId: manager.id,
          assigneeId: supervisor1.id,
          title: "Review team performance reports",
          description: "Compile and review all team performance data for last month.",
          status: "TODO",
          priority: "MEDIUM",
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
        {
          companyId: company.id,
          creatorId: supervisor1.id,
          assigneeId: supervisor1.id,
          title: "Update project documentation",
          description: "Keep all project docs up to date with latest changes.",
          status: "READY_FOR_REVIEW",
          priority: "LOW",
        },
      ],
    });

    console.log(`✅ Demo company 'Acme Corp' created with full hierarchy`);
    console.log(`   Super Admin: admin@acme.com / Admin@123`);
    console.log(`   Manager:     manager@acme.com / Manager@123`);
    console.log(`   Supervisor1: alex@acme.com / Alex@123`);
    console.log(`   Supervisor2: maria@acme.com / Maria@123`);
    console.log(`   Members:     tom@acme.com, lisa@acme.com, mike@acme.com`);
    console.log(`   Access at:   http://localhost:3000/t/acme`);
  } else {
    console.log(`ℹ️  Demo company 'Acme Corp' already exists`);
    const acmeExisting = await prisma.company.findUnique({ where: { slug: "acme" } });
    if (acmeExisting && !acmeExisting.modules.includes("chat")) {
      await prisma.company.update({
        where: { id: acmeExisting.id },
        data: { modules: [...acmeExisting.modules, "chat"] },
      });
      console.log(`✅ Added 'chat' to Acme modules (Team Chat bubble & nav)`);
    }
  }

  console.log("\n🎉 Seed complete!");
  console.log("─────────────────────────────────────────");
  console.log("Platform login: http://localhost:3000/platform/login");
  console.log(`  Email: ${platformEmail}`);
  console.log(`  Password: ${platformEmail === "admin@platform.com" ? "Platform@123" : "(your configured password)"}`);
  console.log("\nAcme tenant: http://localhost:3000/t/acme/login");
  console.log("  Email: admin@acme.com  |  Password: Admin@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
