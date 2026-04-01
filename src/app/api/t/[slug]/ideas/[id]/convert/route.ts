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
  if (idea.status === "CONVERTED") {
    return NextResponse.json({ error: "Idea already converted" }, { status: 400 });
  }

  try {
    const { title, description, assigneeId, priority = "MEDIUM", dueDate, tags } = await req.json();
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
        assigneeId: assigneeId || user.userId,
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

    // Mark idea as converted and store the task reference
    const updatedIdea = await prisma.idea.update({
      where: { id },
      data: { status: "CONVERTED", convertedTaskId: task.id },
    });

    return NextResponse.json({ success: true, data: { task, idea: updatedIdea } }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to convert idea" }, { status: 500 });
  }
}
