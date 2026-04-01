import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string; id: string }> };

const USER_SELECT = {
  id: true, firstName: true, lastName: true, avatarUrl: true,
  roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true,
};

/**
 * POST /api/t/[slug]/ideas/[id]/convert
 * Converts an idea into a task ticket.
 * Body: { title?, description?, assigneeId, priority, dueDate, tags? }
 * Returns the created task + marks the idea as CONVERTED.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idea = await prisma.idea.findUnique({ where: { id } });
  if (!idea || idea.companyId !== user.companyId || idea.userId !== user.userId) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  try {
    const { title, description, assigneeId, priority = "MEDIUM", dueDate, tags } = await req.json();
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { id: true },
    });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const allUsers = await prisma.user.findMany({
      where: { companyId: company.id, isTenantBootstrapAccount: false, isActive: true },
      select: { id: true, parentId: true, roleLevel: { select: { level: true } } },
    });
    const getSubtreeIds = (userId: string): string[] => {
      const children = allUsers.filter((u) => u.parentId === userId).map((u) => u.id);
      return [userId, ...children.flatMap((cid) => getSubtreeIds(cid))];
    };
    const visibleIds = getSubtreeIds(user.userId);
    const currentLevel = allUsers.find((u) => u.id === user.userId)?.roleLevel?.level ?? user.level ?? 0;
    const sameLevelIds = allUsers
      .filter((u) => (u.roleLevel?.level ?? Number.NaN) === currentLevel)
      .map((u) => u.id);
    const assignableIds = new Set([...visibleIds, ...sameLevelIds]);
    const finalAssigneeId = assigneeId || user.userId;
    if (!assignableIds.has(finalAssigneeId)) {
      return NextResponse.json(
        { error: "You can only assign tasks to yourself, same-level peers, or people below you" },
        { status: 403 }
      );
    }

    const taskTitle = typeof title === "string" && title.trim() ? title.trim() : idea.title;
    const taskDescription =
      typeof description === "string"
        ? description.trim() || null
        : idea.body || null;
    const cleanedTagNames = Array.isArray(tags)
      ? tags
          .map((t) => (typeof t === "string" ? t.trim() : ""))
          .filter(Boolean)
          .slice(0, 20)
      : [];
    const withTagPrefix =
      cleanedTagNames.length > 0
        ? `Tags: ${cleanedTagNames.join(", ")}${taskDescription ? `\n\n${taskDescription}` : ""}`
        : taskDescription;

    const task = await prisma.task.create({
      data: {
        companyId: user.companyId,
        creatorId: user.userId,
        assigneeId: finalAssigneeId,
        title: taskTitle,
        description: withTagPrefix,
        priority,
        ...(dueDate && { dueDate: new Date(dueDate) }),
      },
      include: {
        creator: { select: USER_SELECT },
        assignee: { select: USER_SELECT },
        attachments: true,
      },
    });

    const existingIds = Array.isArray(idea.convertedTaskIds)
      ? idea.convertedTaskIds.filter((v): v is string => typeof v === "string" && v.length > 0)
      : [];
    const mergedIds = Array.from(new Set([...existingIds, task.id]));

    // Mark idea as converted and store task references
    const updatedIdea = await prisma.idea.update({
      where: { id },
      data: { status: "CONVERTED", convertedTaskId: task.id, convertedTaskIds: mergedIds },
    });

    return NextResponse.json({ success: true, data: { task, idea: updatedIdea } }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to convert idea" }, { status: 500 });
  }
}
