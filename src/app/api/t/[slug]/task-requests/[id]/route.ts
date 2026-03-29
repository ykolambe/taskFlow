import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

function formatDateForReminderNote(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildSubtreeIds(
  allUsers: { id: string; parentId: string | null }[],
  rootId: string
): string[] {
  const children = allUsers.filter((u) => u.parentId === rootId).map((u) => u.id);
  return [rootId, ...children.flatMap((id) => buildSubtreeIds(allUsers, id))];
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!company.modules.includes("tasks")) {
    return NextResponse.json({ error: "Tasks module is not enabled" }, { status: 403 });
  }

  try {
    const { action, assigneeId, comment } = await req.json();
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
    }

    const tr = await prisma.taskRequest.findUnique({
      where: { id },
      include: {
        requester: { select: USER_SELECT },
        approver: { select: USER_SELECT },
      },
    });

    if (!tr || tr.companyId !== company.id) {
      return NextResponse.json({ error: "Task request not found" }, { status: 404 });
    }

    if (tr.status !== "PENDING") {
      return NextResponse.json({ error: "This request has already been processed" }, { status: 400 });
    }

    const canAct = user.isSuperAdmin || user.userId === tr.approverId;
    if (!canAct) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "reject") {
      const updated = await prisma.taskRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectComment: typeof comment === "string" ? comment.trim() || null : null,
        },
        include: {
          requester: { select: USER_SELECT },
          approver: { select: USER_SELECT },
          createdTask: { select: { id: true, title: true, status: true } },
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    const finalAssigneeId = assigneeId && String(assigneeId).trim() ? String(assigneeId).trim() : tr.requesterId;

    const allUsers = await prisma.user.findMany({
      where: { companyId: company.id, isTenantBootstrapAccount: false },
      select: { id: true, parentId: true },
    });

    if (user.isSuperAdmin) {
      const assigneeOk = await prisma.user.findFirst({
        where: { id: finalAssigneeId, companyId: company.id, isActive: true },
      });
      if (!assigneeOk) {
        return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
      }
    } else {
      const visibleIds = buildSubtreeIds(allUsers, tr.approverId);
      if (!visibleIds.includes(finalAssigneeId)) {
        return NextResponse.json(
          { error: "Assignee must be you or someone in your hierarchy below you" },
          { status: 403 }
        );
      }
    }

    const openStatus = await prisma.taskStatusConfig.findFirst({
      where: { companyId: company.id, type: "OPEN" },
      orderBy: { order: "asc" },
    });
    const initialStatus = openStatus?.key ?? "TODO";

    const reqRef = `REQ-${tr.id.slice(0, 8)}`;
    const systemCommentBody = `Task created from approved task request ${reqRef}.`;

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          companyId: company.id,
          creatorId: tr.requesterId,
          assigneeId: finalAssigneeId,
          title: tr.title,
          description: tr.description,
          priority: tr.priority,
          dueDate: tr.dueDate,
          status: initialStatus,
        },
        include: {
          creator: { select: USER_SELECT },
          assignee: { select: USER_SELECT },
        },
      });

      if (tr.attachmentFileUrl && tr.attachmentFileName) {
        await tx.attachment.create({
          data: {
            taskId: task.id,
            uploaderId: tr.requesterId,
            fileName: tr.attachmentFileName,
            fileUrl: tr.attachmentFileUrl,
            fileSize: tr.attachmentFileSize ?? 0,
            mimeType: tr.attachmentMimeType ?? "application/octet-stream",
          },
        });
      }

      await tx.taskComment.create({
        data: {
          taskId: task.id,
          authorId: user.userId,
          body: systemCommentBody,
          isSystem: true,
        },
      });

      const updatedTr = await tx.taskRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          createdTaskId: task.id,
          approverAssigneeId: finalAssigneeId,
        },
        include: {
          requester: { select: USER_SELECT },
          approver: { select: USER_SELECT },
          createdTask: { select: { id: true, title: true, status: true } },
        },
      });

      return { task, updatedTr };
    });

    if (result.task.dueDate) {
      const dueDateObj = result.task.dueDate;
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
            note: `${tr.title}\nDue date: ${formatDateForReminderNote(dueDateObj)}`,
            remindAt,
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: result.updatedTr, task: result.task });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to process task request" }, { status: 500 });
  }
}
