import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageGroup, canManageGroupSync, getGroupChannelForCompany } from "@/lib/groupChat";
import { isModuleEnabledForUser } from "@/lib/tenantRuntime";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; channelId: string }> | { slug: string; channelId: string } };

const patchBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    avatarUrl: z.union([z.string(), z.null()]).optional(),
  })
  .refine((d) => d.name !== undefined || d.avatarUrl !== undefined, {
    message: "Provide at least one of: name, avatarUrl",
  });

function parseStoredImageUrl(input: string | null): string | null {
  if (input === null) return null;
  const s = input.trim();
  if (!s) return null;
  if (s.length > 2048) return null;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return s;
  } catch {
    return null;
  }
}

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

  const canManageMembers = canManageGroupSync({
    membershipRole: myMembership.role,
    viewerUserId: viewer.userId,
    viewerIsSuperAdmin: viewer.isSuperAdmin,
    channelCreatedById: channel.createdById,
  });

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
      avatarUrl: channel.avatarUrl,
      viewerRole: myMembership.role,
      canManageMembers,
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        user: m.user,
      })),
    },
  });
}

/** Update group name and/or photo (managers only). */
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

  if (!(await canManageGroup(channelId, viewer, channel))) {
    return NextResponse.json(
      { error: "You don't have permission to update this group." },
      { status: 403 }
    );
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

  const data: { name?: string; avatarUrl?: string | null } = {};
  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name.trim();
  }
  if (parsed.data.avatarUrl !== undefined) {
    if (parsed.data.avatarUrl === null) {
      data.avatarUrl = null;
    } else {
      const u = parseStoredImageUrl(parsed.data.avatarUrl);
      if (u === null) {
        return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
      }
      data.avatarUrl = u;
    }
  }

  const updated = await prisma.channel.update({
    where: { id: channelId },
    data,
    select: { id: true, name: true, slug: true, type: true, avatarUrl: true, updatedAt: true },
  });

  return NextResponse.json({ success: true, data: updated });
}
