import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cal = await prisma.calendarCollection.findFirst({
    where: {
      id,
      companyId: user.companyId,
      isArchived: false,
      OR: [{ type: "ORG" }, { ownerUserId: user.userId }],
    },
  });
  if (!cal) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes : null;
  const kind = body?.kind === "MILESTONE" ? "MILESTONE" : "GOAL";
  const color = typeof body?.color === "string" ? body.color : cal.color;
  const startAt = body?.startAt ? new Date(body.startAt) : null;
  const endAt = body?.endAt ? new Date(body.endAt) : null;
  if (!title || !startAt || Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Title and valid startAt are required" }, { status: 400 });
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
    },
  });
  return NextResponse.json({ success: true, data: entry }, { status: 201 });
}
