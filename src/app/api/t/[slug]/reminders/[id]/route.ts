import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string; id: string }> | { slug: string; id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.userReminder.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { title?: string; note?: string | null; remindAt?: string; isDone?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: {
    title?: string;
    note?: string | null;
    remindAt?: Date;
    isDone?: boolean;
  } = {};

  if (body.title !== undefined) {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    data.title = t;
  }
  if (body.note !== undefined) data.note = body.note?.trim() || null;
  if (body.remindAt !== undefined) {
    const d = new Date(body.remindAt);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid remindAt" }, { status: 400 });
    data.remindAt = d;
  }
  if (body.isDone !== undefined) data.isDone = Boolean(body.isDone);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const updated = await prisma.userReminder.update({
    where: { id },
    data,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.userReminder.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.userReminder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
