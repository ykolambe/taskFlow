import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [users, roleLevels] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: company.id, isActive: true },
      include: { roleLevel: true },
      orderBy: [{ firstName: "asc" }],
    }),
    prisma.roleLevel.findMany({ where: { companyId: company.id }, orderBy: { level: "asc" } }),
  ]);

  return NextResponse.json({ success: true, data: { users, roleLevels } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user || !user.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { roleLevels } = await req.json();
  if (!roleLevels || !Array.isArray(roleLevels)) {
    return NextResponse.json({ error: "roleLevels array required" }, { status: 400 });
  }

  for (const rl of roleLevels) {
    if (rl.id) {
      await prisma.roleLevel.update({
        where: { id: rl.id },
        data: { name: rl.name, level: rl.level, color: rl.color, canApprove: rl.canApprove },
      });
    } else {
      await prisma.roleLevel.create({
        data: { companyId: company.id, name: rl.name, level: rl.level, color: rl.color, canApprove: rl.canApprove ?? true },
      });
    }
  }

  const updated = await prisma.roleLevel.findMany({ where: { companyId: company.id }, orderBy: { level: "asc" } });
  return NextResponse.json({ success: true, data: updated });
}
