import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isModuleEnabledForCompany } from "@/lib/tenantRuntime";

type Params = { params: Promise<{ slug: string; channelId: string }> | { slug: string; channelId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug, channelId } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isModuleEnabledForCompany(company.id, "chat"))) {
    return NextResponse.json({ error: "Chat module is disabled for this tenant." }, { status: 403 });
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { roleLevel: true },
  });
  if (!channel || channel.companyId !== company.id) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Basic visibility: any user in company can see GLOBAL/CUSTOM.
  // ROLE channels are visible only if viewer level is <= role level (higher in tree).
  if (channel.type === "ROLE") {
    const viewerRow = await prisma.user.findUnique({
      where: { id: viewer.userId },
      select: { roleLevel: { select: { level: true } } },
    });
    const viewerLevel = viewerRow?.roleLevel?.level ?? 999;
    const roleLevel = channel.roleLevel?.level ?? 999;
    if (viewerLevel > roleLevel) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const rawTake = parseInt(searchParams.get("take") ?? "50", 10);
  const take = Number.isFinite(rawTake) ? Math.min(Math.max(rawTake, 1), 100) : 50;
  const cursor = searchParams.get("cursor");

  const messages = await prisma.channelMessage.findMany({
    where: { companyId: company.id, channelId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          email: true,
          username: true,
          roleLevelId: true,
          roleLevel: true,
          isSuperAdmin: true,
        },
      },
    },
  });

  const hasMore = messages.length > take;
  const sliced = hasMore ? messages.slice(0, take) : messages;
  const nextCursor = hasMore ? sliced[sliced.length - 1]?.id : null;

  return NextResponse.json({
    success: true,
    data: sliced.reverse(), // oldest first for UI
    meta: { take, hasMore, nextCursor },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, channelId } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isModuleEnabledForCompany(company.id, "chat"))) {
    return NextResponse.json({ error: "Chat module is disabled for this tenant." }, { status: 403 });
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { roleLevel: true },
  });
  if (!channel || channel.companyId !== company.id) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  if (channel.type === "ROLE") {
    const viewerRow = await prisma.user.findUnique({
      where: { id: viewer.userId },
      select: { roleLevel: { select: { level: true } } },
    });
    const viewerLevel = viewerRow?.roleLevel?.level ?? 999;
    const roleLevel = channel.roleLevel?.level ?? 999;
    if (viewerLevel > roleLevel) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Message is too long" }, { status: 400 });

  const message = await prisma.channelMessage.create({
    data: {
      companyId: company.id,
      channelId,
      authorId: viewer.userId,
      body: text,
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          email: true,
          username: true,
          roleLevelId: true,
          roleLevel: true,
          isSuperAdmin: true,
        },
      },
    },
  });

  return NextResponse.json({ success: true, data: message }, { status: 201 });
}

