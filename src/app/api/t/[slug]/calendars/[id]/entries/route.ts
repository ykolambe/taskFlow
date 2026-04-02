import { NextRequest, NextResponse } from "next/server";
import type { ContentEntryStatus } from "@prisma/client";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditContentEntry, isContentStudioEnabledForUser } from "@/lib/contentStudio";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cal = await prisma.calendarCollection.findFirst({
    where: {
      id,
      companyId: user.companyId,
      isArchived: false,
      OR: [{ type: "ORG" }, { type: "CHANNEL" }, { ownerUserId: user.userId }],
    },
  });
  if (!cal) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes : null;
  const kind = body?.kind === "MILESTONE" ? "MILESTONE" : body?.kind === "CONTENT" ? "CONTENT" : "GOAL";
  const color = typeof body?.color === "string" ? body.color : cal.color;
  const startAt = body?.startAt ? new Date(body.startAt) : null;
  const endAt = body?.endAt ? new Date(body.endAt) : null;
  if (!title || !startAt || Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Title and valid startAt are required" }, { status: 400 });
  }

  if (kind === "CONTENT") {
    const enabled = await isContentStudioEnabledForUser(user.companyId, user.userId);
    if (!enabled) return NextResponse.json({ error: "Content Studio is not enabled" }, { status: 403 });
    const can = await canEditContentEntry(cal.id, user.companyId, user.userId, user.isSuperAdmin);
    if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assigneeId = typeof body?.assigneeId === "string" ? body.assigneeId : undefined;
  const url = typeof body?.url === "string" ? body.url.trim() || null : undefined;
  let contentStatus: ContentEntryStatus | undefined;
  if (kind === "CONTENT") {
    const s = body?.contentStatus;
    const allowed: ContentEntryStatus[] = [
      "IDEA",
      "DRAFT",
      "IN_REVIEW",
      "APPROVED",
      "READY_TO_PUBLISH",
      "PUBLISHED",
      "CANCELLED",
    ];
    contentStatus =
      typeof s === "string" && (allowed as string[]).includes(s) ? (s as ContentEntryStatus) : "DRAFT";
  }

  const entry = await prisma.calendarEntry.create({
    data: {
      companyId: user.companyId,
      calendarId: cal.id,
      creatorId: user.userId,
      title,
      notes,
      kind,
      color,
      startAt,
      endAt: endAt && !Number.isNaN(endAt.getTime()) ? endAt : null,
      ...(kind === "CONTENT"
        ? {
            contentStatus: contentStatus ?? "DRAFT",
            ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
            ...(url !== undefined && { url }),
          }
        : {}),
    },
  });
  return NextResponse.json({ success: true, data: entry }, { status: 201 });
}
