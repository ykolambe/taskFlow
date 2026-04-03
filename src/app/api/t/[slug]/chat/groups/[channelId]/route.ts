import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGroupChannelForCompany, isGroupAdmin } from "@/lib/groupChat";
import { isModuleEnabledForUser } from "@/lib/tenantRuntime";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; channelId: string }> | { slug: string; channelId: string } };

const patchBodySchema = z.object({
  name: z.string().min(1).max(120),
});

/** Group details: members and roles (any member). */
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug, channelId } = await params;
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

  const myMembership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: viewer.userId } },
    select: { role: true },
  });
  if (!myMembership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await prisma.channelMember.findMany({
    where: { channelId },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          username: true,
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: channel.id,
      name: channel.name,
      createdById: channel.createdById,
      viewerRole: myMembership.role,
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        user: m.user,
      })),
    },
  });
}

/** Rename group (admins only). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, channelId } = await params;
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
    return NextResponse.json({ error: "Only group admins can rename the group." }, { status: 403 });
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

  const name = parsed.data.name.trim();
  const updated = await prisma.channel.update({
    where: { id: channelId },
    data: { name },
    select: { id: true, name: true, slug: true, type: true, updatedAt: true },
  });

  return NextResponse.json({ success: true, data: updated });
}
