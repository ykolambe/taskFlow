import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_SELECT = {
  id: true, firstName: true, lastName: true, avatarUrl: true,
  roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true,
};

function parseDueDateInput(input: string): Date {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, monthIndex, day);
  }
  return new Date(input);
}

function formatDateForReminderNote(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const archived = searchParams.get("archived") === "true";
  const mineOnly = searchParams.get("mineOnly") === "true";
  const rawTake = parseInt(searchParams.get("take") ?? "100", 10);
  const take = Number.isFinite(rawTake) ? Math.min(Math.max(rawTake, 1), 200) : 100;
  const rawSkip = parseInt(searchParams.get("skip") ?? "0", 10);
  const skip = Number.isFinite(rawSkip) && rawSkip > 0 ? rawSkip : 0;

  const allUsers = await prisma.user.findMany({
    where: { companyId: company.id, isTenantBootstrapAccount: false },
    select: { id: true, parentId: true },
  });
  const getSubtreeIds = (userId: string): string[] => {
    const children = allUsers.filter((u) => u.parentId === userId).map((u) => u.id);
    return [userId, ...children.flatMap((id) => getSubtreeIds(id))];
  };
  const visibleIds = getSubtreeIds(user.userId);

  const assigneeFilter = mineOnly ? user.userId : { in: visibleIds };
  const orderBy = mineOnly
    ? ([{ updatedAt: "desc" as const }] as const)
    : ([{ priority: "desc" as const }, { createdAt: "desc" as const }] as const);

  const tasks = await prisma.task.findMany({
    where: {
      companyId: company.id,
      assigneeId: assigneeFilter,
      isArchived: archived,
      ...(status && { status: status as any }),
    },
    orderBy: [...orderBy],
    skip,
    take,
    include: {
      creator: { select: USER_SELECT },
      assignee: { select: USER_SELECT },
      attachments: true,
    },
  });

  return NextResponse.json({
    success: true,
    data: tasks,
    meta: { take, skip, hasMore: tasks.length === take },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, description, assigneeId, priority, dueDate } = await req.json();

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const allUsers2 = await prisma.user.findMany({
      where: { companyId: company.id, isTenantBootstrapAccount: false, isActive: true },
      select: { id: true, parentId: true, roleLevel: { select: { level: true } } },
    });
    const getSubtreeIds2 = (userId: string): string[] => {
      const children = allUsers2.filter((u) => u.parentId === userId).map((u) => u.id);
      return [userId, ...children.flatMap((id) => getSubtreeIds2(id))];
    };
    const visibleIds = getSubtreeIds2(user.userId);
    const currentLevel = allUsers2.find((u) => u.id === user.userId)?.roleLevel?.level ?? user.level ?? 0;
    const sameLevelIds = allUsers2
      .filter((u) => (u.roleLevel?.level ?? Number.NaN) === currentLevel)
      .map((u) => u.id);
    const assignableIds = new Set([...visibleIds, ...sameLevelIds]);

    const finalAssigneeId = assigneeId || user.userId;
    if (!assignableIds.has(finalAssigneeId)) {
      return NextResponse.json({ error: "You can only assign tasks to yourself, same-level peers, or people below you" }, { status: 403 });
    }

    const dueDateObj = dueDate ? parseDueDateInput(String(dueDate)) : null;
    if (dueDateObj && Number.isNaN(dueDateObj.getTime())) {
      return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        companyId: company.id,
        creatorId: user.userId,
        assigneeId: finalAssigneeId,
        title,
        description: description || null,
        priority: priority || "MEDIUM",
        dueDate: dueDateObj,
      },
      include: {
        creator: { select: USER_SELECT },
        assignee: { select: USER_SELECT },
        attachments: true,
      },
    });

    // Auto-create a reminder for the assignee 2 days before the due date.
    // This is intentionally server-side only to avoid client tampering.
    if (dueDateObj) {
      const now = Date.now();
      const remindAt = new Date(dueDateObj.getTime() - 2 * 24 * 60 * 60 * 1000);
      if (remindAt.getTime() > now) {
        const daysUntilDue = Math.max(
          1,
          Math.ceil((dueDateObj.getTime() - now) / (24 * 60 * 60 * 1000))
        );
        await prisma.userReminder.create({
          data: {
            companyId: company.id,
            userId: finalAssigneeId,
            title: `Due in ${daysUntilDue} days`,
            note: `${title}\nDue date: ${formatDateForReminderNote(dueDateObj)}`,
            remindAt,
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: task });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
