import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, signToken } from "@/lib/auth";
import { generatePassword } from "@/lib/utils";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, tasks: true } }, roleLevels: { orderBy: { level: "asc" } } },
  });

  return NextResponse.json({ success: true, data: companies });
}

export async function POST(req: NextRequest) {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, slug, roleLevels, modules } = await req.json();

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ error: "Slug can only contain lowercase letters, numbers, and hyphens" }, { status: 400 });
    }

    const existing = await prisma.company.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "This slug is already taken" }, { status: 409 });
    }

    // Create company
    const company = await prisma.company.create({
      data: { name, slug, modules: modules || ["tasks", "team", "org", "approvals"] },
    });

    // Create role levels
    const createdLevels = await Promise.all(
      (roleLevels || [{ name: "Admin", level: 1, color: "#6366f1" }]).map((rl: { name: string; level: number; color: string }) =>
        prisma.roleLevel.create({
          data: {
            companyId: company.id,
            name: rl.name,
            level: rl.level,
            color: rl.color || "#6366f1",
          },
        })
      )
    );

    // Create default task status configs
    const DEFAULT_STATUSES = [
      { key: "TODO",             label: "To Do",            color: "#64748b", order: 1, type: "OPEN"   as const },
      { key: "IN_PROGRESS",      label: "In Progress",      color: "#3b82f6", order: 2, type: "ACTIVE" as const },
      { key: "READY_FOR_REVIEW", label: "Ready for Review", color: "#f59e0b", order: 3, type: "REVIEW" as const },
      { key: "COMPLETED",        label: "Completed",        color: "#10b981", order: 4, type: "DONE"   as const },
    ];
    await Promise.all(
      DEFAULT_STATUSES.map((s) =>
        prisma.taskStatusConfig.create({ data: { companyId: company.id, ...s } })
      )
    );

    // Create super admin user — intentionally no roleLevelId so they sit
    // outside the org hierarchy and are not conflated with any role level.
    const password = generatePassword(12);
    const email = `admin@${slug}.taskflow.local`;

    const superAdmin = await prisma.user.create({
      data: {
        companyId: company.id,
        // roleLevelId deliberately omitted — super admin is outside the org chart
        email,
        username: "admin",
        passwordHash: await bcrypt.hash(password, 12),
        firstName: "Super",
        lastName: "Admin",
        isSuperAdmin: true,
      },
    });

    return NextResponse.json({
      success: true,
      company,
      credentials: { email, password, slug },
    });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
