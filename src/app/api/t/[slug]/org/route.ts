import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [users, roleLevels, hierarchyTiers] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: company.id, isActive: true, isTenantBootstrapAccount: false },
      include: { roleLevel: true },
      orderBy: [{ firstName: "asc" }],
    }),
    prisma.roleLevel.findMany({ where: { companyId: company.id }, orderBy: { level: "asc" } }),
    prisma.companyHierarchyTier.findMany({ where: { companyId: company.id }, orderBy: { level: "asc" } }),
  ]);

  return NextResponse.json({ success: true, data: { users, roleLevels, hierarchyTiers } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user || !user.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { roleLevels, hierarchyTiers } = await req.json();
  if (!roleLevels || !Array.isArray(roleLevels)) {
    return NextResponse.json({ error: "roleLevels array required" }, { status: 400 });
  }

  try {
  await prisma.$transaction(async (tx) => {
    for (const rl of roleLevels) {
      const level = Number(rl.level);
      if (!Number.isFinite(level) || level < 1 || level > 999) {
        throw new Error("Each role must have a hierarchy level between 1 and 999");
      }
      if (rl.id) {
        await tx.roleLevel.update({
          where: { id: rl.id },
          data: { name: rl.name, level, color: rl.color, canApprove: rl.canApprove },
        });
      } else {
        await tx.roleLevel.create({
          data: {
            companyId: company.id,
            name: rl.name,
            level,
            color: rl.color,
            canApprove: rl.canApprove ?? true,
          },
        });
      }
    }

    if (Array.isArray(hierarchyTiers)) {
      await tx.companyHierarchyTier.deleteMany({ where: { companyId: company.id } });
      for (const t of hierarchyTiers) {
        const level = Number(t.level);
        if (!Number.isFinite(level) || level < 1) continue;
        await tx.companyHierarchyTier.create({
          data: {
            companyId: company.id,
            level,
            defaultAiAddon: Boolean(t.defaultAiAddon),
          },
        });
      }
    }
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const [updated, tiers] = await Promise.all([
    prisma.roleLevel.findMany({ where: { companyId: company.id }, orderBy: { level: "asc" } }),
    prisma.companyHierarchyTier.findMany({ where: { companyId: company.id }, orderBy: { level: "asc" } }),
  ]);
  return NextResponse.json({ success: true, data: updated, hierarchyTiers: tiers });
}
