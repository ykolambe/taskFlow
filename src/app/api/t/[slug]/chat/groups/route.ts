import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isModuleEnabledForUser } from "@/lib/tenantRuntime";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> | { slug: string } };

const MAX_GROUP_MEMBERS = 100;

const createBodySchema = z.object({
  name: z.string().min(1).max(120),
  memberUserIds: z.array(z.string().min(1)).max(MAX_GROUP_MEMBERS - 1),
});

async function uniqueGroupSlug(companyId: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const slug = `g-${randomUUID().replace(/-/g, "")}`;
    const exists = await prisma.channel.findFirst({
      where: { companyId, slug },
      select: { id: true },
    });
    if (!exists) return slug;
  }
  return `g-${randomUUID().replace(/-/g, "")}-${Date.now()}`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  const otherIds = [...new Set(parsed.data.memberUserIds)].filter((id) => id !== viewer.userId);
  if (otherIds.length < 1) {
    return NextResponse.json(
      { error: "Add at least one other person to create a group." },
      { status: 400 }
    );
  }

  const memberIds = [viewer.userId, ...otherIds];
  if (memberIds.length > MAX_GROUP_MEMBERS) {
    return NextResponse.json(
      { error: `A group can have at most ${MAX_GROUP_MEMBERS} members.` },
      { status: 400 }
    );
  }

  const users = await prisma.user.findMany({
    where: {
      id: { in: memberIds },
      companyId: company.id,
      isActive: true,
      isTenantBootstrapAccount: false,
    },
    select: { id: true },
  });
  if (users.length !== memberIds.length) {
    return NextResponse.json(
      { error: "One or more users are invalid or not on your team." },
      { status: 400 }
    );
  }

  const slugVal = await uniqueGroupSlug(company.id);

  const channel = await prisma.channel.create({
    data: {
      companyId: company.id,
      slug: slugVal,
      name,
      type: "GROUP",
      createdById: viewer.userId,
      members: {
        create: memberIds.map((userId) => ({
          companyId: company.id,
          userId,
          role: userId === viewer.userId ? ("ADMIN" as const) : ("MEMBER" as const),
        })),
      },
    },
  });

  return NextResponse.json({ success: true, data: channel }, { status: 201 });
}
