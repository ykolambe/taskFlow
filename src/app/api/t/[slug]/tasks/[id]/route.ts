import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnyTaskStatus } from "@/lib/utils";

const USER_SELECT = {
  id: true, firstName: true, lastName: true, avatarUrl: true,
  roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id },
    include: { creator: { select: USER_SELECT }, assignee: { select: USER_SELECT }, attachments: true },
  });

  if (!task || task.companyId !== user.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: task });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      creator: { include: { roleLevel: true } },
      assignee: { include: { roleLevel: true } },
    },
  });

  if (!task || task.companyId !== currentUser.companyId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { status, title, description, priority, dueDate } = await req.json();

  let isDoneStatus = false;
  if (status) {
    const isAssignee = task.assigneeId === currentUser.userId;
    const isCreator = task.creatorId === currentUser.userId;
    const creatorLevel = task.creator.roleLevel?.level ?? 0;
    const canComplete = isCreator || currentUser.isSuperAdmin || currentUser.level <= creatorLevel;

    const [statusConfig, currentStatusConfig] = await Promise.all([
      prisma.taskStatusConfig.findUnique({
        where: { companyId_key: { companyId: task.companyId, key: status } },
      }),
      prisma.taskStatusConfig.findUnique({
        where: { companyId_key: { companyId: task.companyId, key: task.status } },
      }),
    ]);
    const statusType = statusConfig?.type ?? "ACTIVE";
    const currentStatusType = currentStatusConfig?.type ?? "ACTIVE";
    isDoneStatus = statusType === "DONE";

    if (canManageAnyTaskStatus(currentUser)) {
      // Super admin or top of org (level 1): any transition
    } else if (isAssignee) {
      // Assignees cannot complete, reopen, or move back to backlog — managers/admins handle that
      if (statusType === "DONE") {
        return NextResponse.json(
          { error: "Only a manager or admin can mark a task complete or incomplete" },
          { status: 403 }
        );
      }
      if (currentStatusType === "DONE") {
        return NextResponse.json(
          { error: "Only a manager or admin can mark a task complete or incomplete" },
          { status: 403 }
        );
      }
      if (statusType === "OPEN" && currentStatusType !== "OPEN") {
        return NextResponse.json(
          { error: "Only a manager can move this task back to backlog" },
          { status: 403 }
        );
      }
    } else {
      if (isDoneStatus && !canComplete) {
        return NextResponse.json({ error: "Only the task creator or higher level can mark as completed" }, { status: 403 });
      }
      if (["ACTIVE", "REVIEW"].includes(statusType) && !canComplete) {
        return NextResponse.json({ error: "Only the assignee can update this status" }, { status: 403 });
      }
    }
  }

  const isCompleted = isDoneStatus;
  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(isCompleted && { completedAt: new Date(), isArchived: true }),
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(priority && { priority }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
    include: { creator: { select: USER_SELECT }, assignee: { select: USER_SELECT }, attachments: true },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.companyId !== currentUser.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (task.creatorId !== currentUser.userId && !currentUser.isSuperAdmin) {
    return NextResponse.json({ error: "Only the creator can delete a task" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
