import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextDueDate } from "@/lib/utils";
import { isModuleEnabledForCompany } from "@/lib/tenantRuntime";

const USER_SELECT = {
  id: true, firstName: true, lastName: true, avatarUrl: true,
  roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isModuleEnabledForCompany(company.id, "recurring"))) {
    return NextResponse.json({ error: "Recurring module is disabled for this tenant." }, { status: 403 });
  }

  const allUsers = await prisma.user.findMany({ where: { companyId: company.id }, select: { id: true, parentId: true } });
  const getSubtreeIds = (userId: string): string[] => {
    const children = allUsers.filter((u) => u.parentId === userId).map((u) => u.id);
    return [userId, ...children.flatMap((id) => getSubtreeIds(id))];
  };
  const visibleIds = getSubtreeIds(user.userId);

  const recurring = await prisma.recurringTask.findMany({
    where: { companyId: company.id, assigneeId: { in: visibleIds } },
    include: { creator: { select: USER_SELECT }, assignee: { select: USER_SELECT } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: recurring });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const {
      title,
      description,
      assigneeId,
      priority,
      frequency,
      daysOfWeek,
      dayOfMonth,
      startDate,
      endDate,
      templateAttachments,
    } = await req.json();

    if (!title || !frequency) {
      return NextResponse.json({ error: "Title and frequency are required" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await isModuleEnabledForCompany(company.id, "recurring"))) {
      return NextResponse.json({ error: "Recurring module is disabled for this tenant." }, { status: 403 });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const nextDue = getNextDueDate(frequency, daysOfWeek || [], dayOfMonth || null, start);

    const recurring = await prisma.recurringTask.create({
      data: {
        companyId: company.id,
        creatorId: user.userId,
        assigneeId: assigneeId || user.userId,
        title,
        description: description || null,
        priority: priority || "MEDIUM",
        frequency,
        daysOfWeek: daysOfWeek || [],
        dayOfMonth: dayOfMonth || null,
        startDate: start,
        endDate: endDate ? new Date(endDate) : null,
        templateAttachments: templateAttachments || [],
        nextDue,
      },
      include: { creator: { select: USER_SELECT }, assignee: { select: USER_SELECT } },
    });

    // Only spawn the first task instance if startDate is today or in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start <= today) {
      const firstTask = await prisma.task.create({
        data: {
          companyId: company.id,
          creatorId: user.userId,
          assigneeId: assigneeId || user.userId,
          title,
          description: description || null,
          priority: priority || "MEDIUM",
          dueDate: nextDue,
          recurringId: recurring.id,
        },
      });
      if (Array.isArray(templateAttachments) && templateAttachments.length > 0) {
        await prisma.attachment.createMany({
          data: templateAttachments.map((a: { fileName: string; fileUrl: string; fileSize: number; mimeType: string }) => ({
            taskId: firstTask.id,
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            uploaderId: user.userId,
          })),
        });
      }
      await prisma.recurringTask.update({ where: { id: recurring.id }, data: { lastGenerated: new Date() } });
    }

    return NextResponse.json({ success: true, data: recurring });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create recurring task" }, { status: 500 });
  }
}
