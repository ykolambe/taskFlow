import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAncestorUserIds } from "@/lib/hierarchy";
import type { Priority } from "@prisma/client";
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!company.modules.includes("tasks")) {
    return NextResponse.json({ error: "Tasks module is not enabled" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "all";

  const baseInclude = {
    requester: { select: USER_SELECT },
    approver: { select: USER_SELECT },
    createdTask: { select: { id: true, title: true, status: true } },
  };

  if (user.isSuperAdmin && scope === "all") {
    const data = await prisma.taskRequest.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      include: baseInclude,
    });
    return NextResponse.json({ success: true, data });
  }

  if (scope === "incoming") {
    const data = await prisma.taskRequest.findMany({
      where: { companyId: company.id, approverId: user.userId },
      orderBy: { createdAt: "desc" },
      include: baseInclude,
    });
    return NextResponse.json({ success: true, data });
  }

  if (scope === "outgoing") {
    const data = await prisma.taskRequest.findMany({
      where: { companyId: company.id, requesterId: user.userId },
      orderBy: { createdAt: "desc" },
      include: baseInclude,
    });
    return NextResponse.json({ success: true, data });
  }

  const data = await prisma.taskRequest.findMany({
    where: {
      companyId: company.id,
      OR: [{ requesterId: user.userId }, { approverId: user.userId }],
    },
    orderBy: { createdAt: "desc" },
    include: baseInclude,
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      title,
      description,
      approverId,
      priority,
      dueDate,
      attachment,
    }: {
      title?: string;
      description?: string;
      approverId?: string;
      priority?: string;
      dueDate?: string | null;
      attachment?: {
        url?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
      } | null;
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!approverId) {
      return NextResponse.json({ error: "approverId is required" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!company.modules.includes("tasks")) {
      return NextResponse.json({ error: "Tasks module is not enabled" }, { status: 403 });
    }

    const chain = await getAncestorUserIds(user.userId);

    if (user.isSuperAdmin) {
      if (approverId === user.userId) {
        return NextResponse.json({ error: "Choose a different approver" }, { status: 400 });
      }
      const approverUser = await prisma.user.findFirst({
        where: { id: approverId, companyId: company.id, isActive: true },
      });
      if (!approverUser) {
        return NextResponse.json({ error: "Invalid approver" }, { status: 400 });
      }
    } else {
      if (!chain.includes(approverId)) {
        return NextResponse.json(
          { error: "Approver must be someone above you in the reporting line" },
          { status: 400 }
        );
      }
    }

    let attUrl: string | null = null;
    let attName: string | null = null;
    let attMime: string | null = null;
    let attSize: number | null = null;
    if (attachment && (attachment.url || attachment.fileName)) {
      if (!attachment.url || !attachment.fileName) {
        return NextResponse.json(
          { error: "Attachment requires url and fileName" },
          { status: 400 }
        );
      }
      attUrl = attachment.url;
      attName = attachment.fileName;
      attMime = attachment.mimeType ?? "application/octet-stream";
      attSize = attachment.fileSize ?? 0;
    }

    const dueDateObj = dueDate ? parseDueDateInput(String(dueDate)) : null;
    if (dueDateObj && Number.isNaN(dueDateObj.getTime())) {
      return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
    }

    const row = await prisma.taskRequest.create({
      data: {
        companyId: company.id,
        requesterId: user.userId,
        approverId,
        title: title.trim(),
        description: description?.trim() || null,
        priority: (priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? priority : "MEDIUM") as Priority,
        dueDate: dueDateObj,
        attachmentFileUrl: attUrl,
        attachmentFileName: attName,
        attachmentMimeType: attMime,
        attachmentFileSize: attSize,
        status: "PENDING",
      },
      include: {
        requester: { select: USER_SELECT },
        approver: { select: USER_SELECT },
        createdTask: { select: { id: true, title: true, status: true } },
      },
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create task request" }, { status: 500 });
  }
}
