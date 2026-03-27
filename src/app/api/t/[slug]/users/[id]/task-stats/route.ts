import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string; id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug, id: userId } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  // Make sure target user exists in this company
  const targetUser = await prisma.user.findFirst({
    where: { id: userId, companyId: company.id, isActive: true },
    select: { id: true, parentId: true },
  });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Visibility: current user can see themselves + their subtree
  const allUsers = await prisma.user.findMany({
    where: { companyId: company.id, isActive: true },
    select: { id: true, parentId: true },
  });
  const getSubtreeIds = (id: string): string[] => {
    const children = allUsers.filter((u) => u.parentId === id).map((u) => u.id);
    return [id, ...children.flatMap((cid) => getSubtreeIds(cid))];
  };
  const visibleIds = new Set(getSubtreeIds(currentUser.userId));
  if (!visibleIds.has(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Status configs to know which statuses are DONE-type
  const statusConfigs = await prisma.taskStatusConfig.findMany({
    where: { companyId: company.id },
  });
  const doneKeys = statusConfigs.filter((s) => s.type === "DONE").map((s) => s.key);

  const tasks = await prisma.task.findMany({
    where: {
      companyId: company.id,
      assigneeId: userId,
    },
    select: {
      status: true,
      isArchived: true,
    },
  });

  const byStatus: Record<string, number> = {};
  let total = 0;
  let completed = 0;
  let open = 0;
  let archived = 0;

  for (const t of tasks) {
    total += 1;
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    if (t.isArchived || doneKeys.includes(t.status)) {
      completed += 1;
      if (t.isArchived) archived += 1;
    } else {
      open += 1;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      totals: { total, open, completed, archived },
      byStatus,
      doneStatuses: doneKeys,
    },
  });
}
