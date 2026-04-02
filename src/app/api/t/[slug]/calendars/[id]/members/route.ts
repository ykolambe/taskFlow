import { NextRequest, NextResponse } from "next/server";
import type { CalendarMemberRole } from "@prisma/client";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCalendarMembers, isContentStudioEnabledForUser } from "@/lib/contentStudio";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enabled = await isContentStudioEnabledForUser(user.companyId, user.userId);
  if (!enabled) return NextResponse.json({ error: "Content Studio is not enabled" }, { status: 403 });

  const cal = await prisma.calendarCollection.findFirst({
    where: {
      id,
      companyId: user.companyId,
      isArchived: false,
      type: "CHANNEL",
    },
  });
  if (!cal) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });

  const canManage = await canManageCalendarMembers(id, user.companyId, user.userId, user.isSuperAdmin);
  const selfMember = await prisma.calendarMember.findUnique({
    where: { calendarId_userId: { calendarId: id, userId: user.userId } },
  });
  if (!canManage && !selfMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.calendarMember.findMany({
    where: { calendarId: id },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enabled = await isContentStudioEnabledForUser(user.companyId, user.userId);
  if (!enabled) return NextResponse.json({ error: "Content Studio is not enabled" }, { status: 403 });

  const cal = await prisma.calendarCollection.findFirst({
    where: { id, companyId: user.companyId, isArchived: false, type: "CHANNEL" },
  });
  if (!cal) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });

  const canManage = await canManageCalendarMembers(id, user.companyId, user.userId, user.isSuperAdmin);
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const targetUserId = typeof body?.userId === "string" ? body.userId : "";
  const role = (typeof body?.role === "string" ? body.role : "EDIT") as CalendarMemberRole;
  const roles: CalendarMemberRole[] = ["VIEW", "EDIT", "PUBLISH", "ADMIN"];
  if (!targetUserId || !roles.includes(role)) {
    return NextResponse.json({ error: "userId and valid role required" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, companyId: user.companyId, isActive: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const row = await prisma.calendarMember.upsert({
    where: { calendarId_userId: { calendarId: id, userId: targetUserId } },
    create: { calendarId: id, userId: targetUserId, role },
    update: { role },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({ success: true, data: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enabled = await isContentStudioEnabledForUser(user.companyId, user.userId);
  if (!enabled) return NextResponse.json({ error: "Content Studio is not enabled" }, { status: 403 });

  const cal = await prisma.calendarCollection.findFirst({
    where: { id, companyId: user.companyId, isArchived: false, type: "CHANNEL" },
  });
  if (!cal) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });

  const canManage = await canManageCalendarMembers(id, user.companyId, user.userId, user.isSuperAdmin);
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId");
  if (!targetUserId) return NextResponse.json({ error: "userId query required" }, { status: 400 });

  await prisma.calendarMember.deleteMany({
    where: { calendarId: id, userId: targetUserId },
  });

  return NextResponse.json({ success: true });
}
