import { NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_SELECT = {
  id: true, firstName: true, lastName: true, avatarUrl: true,
  roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true,
};

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idea = await prisma.idea.findUnique({ where: { id } });
  if (!idea || idea.companyId !== user.companyId || idea.userId !== user.userId) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const idsFromJson = Array.isArray(idea.convertedTaskIds)
    ? idea.convertedTaskIds.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  const allIds = Array.from(new Set([...(idea.convertedTaskId ? [idea.convertedTaskId] : []), ...idsFromJson]));
  if (allIds.length === 0) return NextResponse.json({ success: true, data: [] });

  const tasks = await prisma.task.findMany({
    where: { companyId: user.companyId, id: { in: allIds } },
    include: {
      creator: { select: USER_SELECT },
      assignee: { select: USER_SELECT },
      attachments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: tasks });
}
