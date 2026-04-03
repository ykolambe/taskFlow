import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTeamChatChannel } from "@/lib/teamChatAccess";
import { isModuleEnabledForUser } from "@/lib/tenantRuntime";

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
  if (!(await isModuleEnabledForUser(company.id, viewer.userId, "chat"))) {
    return NextResponse.json({ error: "Chat is not available for your account." }, { status: 403 });
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });
  if (!channel || channel.companyId !== company.id) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const allowed = await canAccessTeamChatChannel({
    channel: {
      id: channel.id,
      companyId: channel.companyId,
      type: channel.type,
      dmUserLowId: channel.dmUserLowId,
      dmUserHighId: channel.dmUserHighId,
    },
    viewerUserId: viewer.userId,
    companyId: company.id,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawTake = parseInt(searchParams.get("take") ?? "50", 10);
  const take = Number.isFinite(rawTake) ? Math.min(Math.max(rawTake, 1), 100) : 50;
  const cursor = searchParams.get("cursor");
  const qRaw = searchParams.get("q")?.trim() ?? "";
  const q = qRaw.length > 200 ? qRaw.slice(0, 200) : qRaw;

  const messages = await prisma.channelMessage.findMany({
    where: {
      companyId: company.id,
      channelId,
      ...(q
        ? {
            body: { contains: q, mode: "insensitive" as const },
          }
        : {}),
    },
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
    meta: { take, hasMore, nextCursor, q: q || undefined },
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
  if (!(await isModuleEnabledForUser(company.id, viewer.userId, "chat"))) {
    return NextResponse.json({ error: "Chat is not available for your account." }, { status: 403 });
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });
  if (!channel || channel.companyId !== company.id) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const allowed = await canAccessTeamChatChannel({
    channel: {
      id: channel.id,
      companyId: channel.companyId,
      type: channel.type,
      dmUserLowId: channel.dmUserLowId,
      dmUserHighId: channel.dmUserHighId,
    },
    viewerUserId: viewer.userId,
    companyId: company.id,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { text?: string; attachments?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (text.length > 2000) return NextResponse.json({ error: "Message is too long" }, { status: 400 });

  const rawAtt = Array.isArray(body.attachments) ? body.attachments : [];
  const attachments: { url: string; mimeType: string; kind: "image" | "video"; fileName?: string }[] = [];
  for (const item of rawAtt.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const url = typeof r.url === "string" ? r.url.trim() : "";
    if (!url || url.length > 2048) continue;
    if (!url.startsWith("/") && !/^https?:\/\//i.test(url)) continue;
    const mimeType =
      typeof r.mimeType === "string" && r.mimeType.length < 200 ? r.mimeType : "application/octet-stream";
    const kind = r.kind === "video" ? ("video" as const) : ("image" as const);
    const fileName =
      typeof r.fileName === "string" && r.fileName.length < 500 ? r.fileName : undefined;
    attachments.push({ url, mimeType, kind, fileName });
  }

  if (!text && attachments.length === 0) {
    return NextResponse.json({ error: "Add text or attach an image/video" }, { status: 400 });
  }

  const message = await prisma.channelMessage.create({
    data: {
      companyId: company.id,
      channelId,
      authorId: viewer.userId,
      body: text,
      attachments,
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

