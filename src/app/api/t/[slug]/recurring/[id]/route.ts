import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextDueDate } from "@/lib/utils";
import { isModuleEnabledForUser } from "@/lib/tenantRuntime";

const USER_SELECT = {
  id: true, firstName: true, lastName: true, avatarUrl: true,
  roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true,
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recurring = await prisma.recurringTask.findFirst({
    where: { id, company: { slug } },
    include: { company: { select: { id: true } } },
  });
  if (!recurring) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isModuleEnabledForUser(recurring.company.id, user.userId, "recurring"))) {
    return NextResponse.json({ error: "Recurring is not available for your account." }, { status: 403 });
  }
  if (recurring.creatorId !== user.userId && !user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, description, priority, frequency, daysOfWeek, dayOfMonth, startDate, endDate, isActive, templateAttachments } = body;

    const freq = frequency ?? recurring.frequency;
    const days = daysOfWeek ?? recurring.daysOfWeek;
    const dom = dayOfMonth ?? recurring.dayOfMonth;
    const start = startDate ? new Date(startDate) : recurring.startDate;
    const nextDue = getNextDueDate(freq, days, dom, start);

    const updated = await prisma.recurringTask.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(priority !== undefined && { priority }),
        ...(frequency !== undefined && { frequency: freq }),
        ...(daysOfWeek !== undefined && { daysOfWeek: days }),
        ...(dayOfMonth !== undefined && { dayOfMonth: dom }),
        ...(startDate !== undefined && { startDate: start }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isActive !== undefined && { isActive }),
        ...(templateAttachments !== undefined && { templateAttachments }),
        nextDue,
      },
      include: { creator: { select: USER_SELECT }, assignee: { select: USER_SELECT } },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update recurring task" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recurring = await prisma.recurringTask.findFirst({
    where: { id, company: { slug } },
    include: { company: { select: { id: true } } },
  });
  if (!recurring) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isModuleEnabledForUser(recurring.company.id, user.userId, "recurring"))) {
    return NextResponse.json({ error: "Recurring is not available for your account." }, { status: 403 });
  }
  if (recurring.creatorId !== user.userId && !user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.recurringTask.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
