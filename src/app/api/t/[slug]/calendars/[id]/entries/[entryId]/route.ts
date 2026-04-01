import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string; entryId: string }> }) {
  const { slug, id, entryId } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.calendarEntry.findFirst({
    where: {
      id: entryId,
      calendarId: id,
      companyId: user.companyId,
      calendar: { OR: [{ type: "ORG" }, { ownerUserId: user.userId }] },
    },
    include: { calendar: true },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
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

  const updated = await prisma.calendarEntry.update({ where: { id: entryId }, data });
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
      calendar: { OR: [{ type: "ORG" }, { ownerUserId: user.userId }] },
    },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  await prisma.calendarEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ success: true });
}
