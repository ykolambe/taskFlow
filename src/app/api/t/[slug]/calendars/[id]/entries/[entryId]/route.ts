import { NextRequest, NextResponse } from "next/server";
import type { ContentEntryStatus } from "@prisma/client";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canEditContentEntry,
  canPublishContent,
  isContentStudioEnabledForUser,
} from "@/lib/contentStudio";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string; entryId: string }> }) {
  const { slug, id, entryId } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.calendarEntry.findFirst({
    where: {
      id: entryId,
      calendarId: id,
      companyId: user.companyId,
      calendar: { OR: [{ type: "ORG" }, { type: "CHANNEL" }, { ownerUserId: user.userId }] },
    },
    include: { calendar: true },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (entry.kind === "CONTENT") {
    const enabled = await isContentStudioEnabledForUser(user.companyId, user.userId);
    if (!enabled) return NextResponse.json({ error: "Content Studio is not enabled" }, { status: 403 });

    const canEdit = await canEditContentEntry(entry.calendarId, user.companyId, user.userId, user.isSuperAdmin);
    const canPub = await canPublishContent(entry.calendarId, user.companyId, user.userId, user.isSuperAdmin);

    if (typeof body?.title === "string") data.title = body.title.trim();
    if (typeof body?.notes === "string" || body?.notes === null) data.notes = body.notes;
    if (typeof body?.color === "string") data.color = body.color;
    if (body?.startAt) {
      const d = new Date(body.startAt);
      if (!Number.isNaN(d.getTime())) data.startAt = d;
    }
    if (body?.endAt !== undefined) {
      if (body.endAt === null || body.endAt === "") data.endAt = null;
      else {
        const d = new Date(body.endAt);
        if (!Number.isNaN(d.getTime())) data.endAt = d;
      }
    }
    if (body?.isDone !== undefined) data.isDone = Boolean(body.isDone);
    if (body?.assigneeId !== undefined) {
      if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const aid = typeof body.assigneeId === "string" ? body.assigneeId : null;
      if (aid) {
        const u = await prisma.user.findFirst({ where: { id: aid, companyId: user.companyId } });
        if (!u) return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
      }
      data.assigneeId = aid;
    }
    if (body?.url !== undefined) {
      if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      data.url = typeof body.url === "string" ? body.url.trim() || null : null;
    }

    if (body?.contentStatus !== undefined) {
      const next = body.contentStatus as ContentEntryStatus;
      const current = entry.contentStatus ?? "DRAFT";
      const order: ContentEntryStatus[] = [
        "IDEA",
        "DRAFT",
        "IN_REVIEW",
        "APPROVED",
        "READY_TO_PUBLISH",
        "PUBLISHED",
        "CANCELLED",
      ];
      const editorStatuses: ContentEntryStatus[] = ["IDEA", "DRAFT", "IN_REVIEW"];
      const publisherStatuses: ContentEntryStatus[] = ["APPROVED", "READY_TO_PUBLISH", "PUBLISHED", "CANCELLED"];

      if (!order.includes(next)) {
        return NextResponse.json({ error: "Invalid contentStatus" }, { status: 400 });
      }

      if (editorStatuses.includes(next) && !canEdit) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (publisherStatuses.includes(next) && !canPub) {
        return NextResponse.json({ error: "Only approvers can set this status" }, { status: 403 });
      }

      data.contentStatus = next;
      if (next === "APPROVED" || next === "PUBLISHED") {
        data.approvedById = user.userId;
        data.approvedAt = new Date();
      }
      if (next === "DRAFT" || next === "IDEA") {
        data.approvedById = null;
        data.approvedAt = null;
      }
    }
  } else {
    if (typeof body?.title === "string") data.title = body.title.trim();
    if (typeof body?.notes === "string" || body?.notes === null) data.notes = body.notes;
    if (typeof body?.color === "string") data.color = body.color;
    if (body?.kind === "GOAL" || body?.kind === "MILESTONE") data.kind = body.kind;
    if (body?.isDone !== undefined) data.isDone = Boolean(body.isDone);
    if (body?.startAt) {
      const d = new Date(body.startAt);
      if (!Number.isNaN(d.getTime())) data.startAt = d;
    }
    if (body?.endAt !== undefined) {
      if (body.endAt === null || body.endAt === "") data.endAt = null;
      else {
        const d = new Date(body.endAt);
        if (!Number.isNaN(d.getTime())) data.endAt = d;
      }
    }
  }

  const updated = await prisma.calendarEntry.update({ where: { id: entryId }, data: data as object });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string; id: string; entryId: string }> }) {
  const { slug, id, entryId } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.calendarEntry.findFirst({
    where: {
      id: entryId,
      calendarId: id,
      companyId: user.companyId,
      calendar: { OR: [{ type: "ORG" }, { type: "CHANNEL" }, { ownerUserId: user.userId }] },
    },
    include: { calendar: true },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  if (entry.kind === "CONTENT") {
    const ok = await canEditContentEntry(entry.calendarId, user.companyId, user.userId, user.isSuperAdmin);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.calendarEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ success: true });
}
