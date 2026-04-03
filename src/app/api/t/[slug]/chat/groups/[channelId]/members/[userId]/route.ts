import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countGroupAdmins, getGroupChannelForCompany, isGroupAdmin } from "@/lib/groupChat";
import { isModuleEnabledForUser } from "@/lib/tenantRuntime";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ slug: string; channelId: string; userId: string }> | { slug: string; channelId: string; userId: string };
};

const patchBodySchema = z.object({
  role: z.enum(["MEMBER", "ADMIN"]),
});

/**
 * Change a member's role (admins only). Cannot remove the last admin — promote someone else first.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, channelId, userId: targetUserId } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isModuleEnabledForUser(company.id, viewer.userId, "chat"))) {
    return NextResponse.json({ error: "Chat is not available for your account." }, { status: 403 });
  }

  const channel = await getGroupChannelForCompany(company.id, channelId);
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await isGroupAdmin(channelId, viewer.userId))) {
    return NextResponse.json({ error: "Only group admins can change roles." }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const nextRole = parsed.data.role;

  const target = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: targetUserId } },
    select: { id: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (target.role === "ADMIN" && nextRole === "MEMBER") {
    const admins = await countGroupAdmins(channelId);
    if (admins <= 1) {
      return NextResponse.json(
        { error: "There must be at least one admin. Promote another member to admin first." },
        { status: 400 }
      );
    }
  }

  await prisma.channelMember.update({
    where: { id: target.id },
    data: { role: nextRole },
  });

  return NextResponse.json({ success: true });
}

/**
 * Leave the group (self) or remove a member (admins). Last member leaving deletes the group.
 * Sole admin leaving promotes the longest-joined remaining member to admin.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { slug, channelId, userId: targetUserId } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isModuleEnabledForUser(company.id, viewer.userId, "chat"))) {
    return NextResponse.json({ error: "Chat is not available for your account." }, { status: 403 });
  }

  const channel = await getGroupChannelForCompany(company.id, channelId);
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const target = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: targetUserId } },
    select: { id: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSelf = targetUserId === viewer.userId;
  if (!isSelf && !(await isGroupAdmin(channelId, viewer.userId))) {
    return NextResponse.json({ error: "Only group admins can remove members." }, { status: 403 });
  }

  if (!isSelf && target.role === "ADMIN") {
    const admins = await countGroupAdmins(channelId);
    if (admins <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the only admin. Promote another member first." },
        { status: 400 }
      );
    }
  }

  const memberCount = await prisma.channelMember.count({ where: { channelId } });

  if (memberCount <= 1) {
    await prisma.channel.delete({ where: { id: channelId } });
    return NextResponse.json({ success: true, data: { channelDeleted: true } });
  }

  if (isSelf && target.role === "ADMIN") {
    const admins = await countGroupAdmins(channelId);
    if (admins === 1) {
      const replacement = await prisma.channelMember.findFirst({
        where: { channelId, userId: { not: viewer.userId } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (replacement) {
        await prisma.$transaction([
          prisma.channelMember.update({
            where: { id: replacement.id },
            data: { role: "ADMIN" },
          }),
          prisma.channelMember.delete({ where: { id: target.id } }),
        ]);
        return NextResponse.json({ success: true });
      }
    }
  }

  await prisma.channelMember.delete({ where: { id: target.id } });

  const remaining = await prisma.channelMember.count({ where: { channelId } });
  if (remaining === 0) {
    await prisma.channel.delete({ where: { id: channelId } });
    return NextResponse.json({ success: true, data: { channelDeleted: true } });
  }

  return NextResponse.json({ success: true });
}
