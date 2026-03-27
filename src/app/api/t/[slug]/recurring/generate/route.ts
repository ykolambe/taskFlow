import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextDueDate } from "@/lib/utils";
import { isModuleEnabledForCompany } from "@/lib/tenantRuntime";

/**
 * POST /api/t/[slug]/recurring/generate
 * Called on dashboard load to create new task instances for any
 * recurring tasks whose nextDue date has arrived.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isModuleEnabledForCompany(company.id, "recurring"))) {
    return NextResponse.json({ error: "Recurring module is disabled for this tenant." }, { status: 403 });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find all active recurring tasks that are due today or overdue and haven't ended
  const dueTasks = await prisma.recurringTask.findMany({
    where: {
      companyId: company.id,
      isActive: true,
      startDate: { lte: now },
      nextDue: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    },
  });

  let generated = 0;

  for (const rt of dueTasks) {
    // Check if a task for this recurring entry was already created today
    const existingToday = await prisma.task.findFirst({
      where: {
        recurringId: rt.id,
        createdAt: { gte: today },
      },
    });
    if (existingToday) continue;

    // Create the new task instance
    const generatedTask = await prisma.task.create({
      data: {
        companyId: rt.companyId,
        creatorId: rt.creatorId,
        assigneeId: rt.assigneeId,
        title: rt.title,
        description: rt.description,
        priority: rt.priority,
        dueDate: rt.nextDue,
        recurringId: rt.id,
      },
    });
    const templateAttachments = (rt.templateAttachments as Array<{
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
    }>) || [];
    if (templateAttachments.length > 0) {
      await prisma.attachment.createMany({
        data: templateAttachments.map((a) => ({
          taskId: generatedTask.id,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          uploaderId: rt.creatorId,
        })),
      });
    }

    // Advance nextDue to the following occurrence
    const newNextDue = getNextDueDate(rt.frequency, rt.daysOfWeek, rt.dayOfMonth, rt.nextDue ?? undefined);

    // Deactivate if past endDate
    const shouldDeactivate = rt.endDate && newNextDue > rt.endDate;

    await prisma.recurringTask.update({
      where: { id: rt.id },
      data: {
        lastGenerated: now,
        nextDue: newNextDue,
        ...(shouldDeactivate && { isActive: false }),
      },
    });

    generated++;
  }

  return NextResponse.json({ success: true, generated });
}
