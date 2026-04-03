import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageGroup, getGroupChannelForCompany } from "@/lib/groupChat";
import { isModuleEnabledForUser } from "@/lib/tenantRuntime";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; channelId: string }> | { slug: string; channelId: string } };

const MAX_GROUP_MEMBERS = 100;

const postBodySchema = z.object({
  userId: z.string().min(1),
});

/** Add a member to the group (admins only). */
export async function POST(req: NextRequest, { params }: Params) {
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
    return NextResponse.json({ error: "You don't have permission to add people to this group." }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const newUserId = parsed.data.userId;
  if (newUserId === viewer.userId) {
    return NextResponse.json({ error: "You're already in this group." }, { status: 400 });
  }

  const existing = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: newUserId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "That person is already in the group." }, { status: 400 });
  }

  const count = await prisma.channelMember.count({ where: { channelId } });
  if (count >= MAX_GROUP_MEMBERS) {
    return NextResponse.json(
      { error: `This group already has the maximum of ${MAX_GROUP_MEMBERS} members.` },
      { status: 400 }
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      id: newUserId,
      companyId: company.id,
      isActive: true,
      isTenantBootstrapAccount: false,
    },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found or not eligible for chat." }, { status: 400 });
  }

  await prisma.channelMember.create({
    data: {
      companyId: company.id,
      channelId,
      userId: newUserId,
      role: "MEMBER",
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
