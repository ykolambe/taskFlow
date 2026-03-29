import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAncestorUserIds } from "@/lib/hierarchy";

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  username: true,
  avatarUrl: true,
  roleLevelId: true,
  roleLevel: true,
  isSuperAdmin: true,
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chainIds = await getAncestorUserIds(user.userId);

  if (user.isSuperAdmin && chainIds.length === 0) {
    const others = await prisma.user.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        isTenantBootstrapAccount: false,
        id: { not: user.userId },
      },
      select: USER_SELECT,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return NextResponse.json({ success: true, data: others });
  }

  if (chainIds.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const approvers = await prisma.user.findMany({
    where: {
      id: { in: chainIds },
      companyId: company.id,
      isActive: true,
      isTenantBootstrapAccount: false,
    },
    select: USER_SELECT,
  });

  const order = new Map(chainIds.map((id, i) => [id, i]));
  approvers.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return NextResponse.json({ success: true, data: approvers });
}
