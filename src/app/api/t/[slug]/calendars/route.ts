import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isContentStudioEnabledForUser } from "@/lib/contentStudio";
import {
  getContentPlatformPreset,
  isValidPresetId,
  type ContentPlatformPresetId,
} from "@/lib/contentPlatformPresets";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const calendars = await prisma.calendarCollection.findMany({
    where: {
      companyId: user.companyId,
      isArchived: false,
      OR: [{ type: "ORG" }, { type: "CHANNEL" }, { ownerUserId: user.userId }],
    },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ success: true, data: calendars });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const rawType = body?.type;
    const type =
      rawType === "ORG" || rawType === "PERSONAL" || rawType === "CHANNEL" ? rawType : "PERSONAL";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const color = typeof body?.color === "string" ? body.color : "#22c55e";
    const rawChannelLabel =
      typeof body?.contentChannel === "string" && body.contentChannel.trim()
        ? body.contentChannel.trim().slice(0, 64)
        : null;
    const rawPreset =
      typeof body?.contentPlatformPreset === "string" ? body.contentPlatformPreset.trim().toLowerCase() : "";
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    if (type === "CHANNEL") {
      const ok = await isContentStudioEnabledForUser(user.companyId, user.userId);
      if (!ok) return NextResponse.json({ error: "Content Studio add-on is not enabled" }, { status: 403 });
      if (!user.isSuperAdmin && user.level !== 1) {
        return NextResponse.json({ error: "Only workspace admins can create channel calendars" }, { status: 403 });
      }
      if (!rawPreset || !isValidPresetId(rawPreset)) {
        return NextResponse.json({ error: "Platform is required for channel boards" }, { status: 400 });
      }
      if (rawPreset === "custom" && !rawChannelLabel) {
        return NextResponse.json({ error: "Enter a custom channel label (e.g. Newsletter)" }, { status: 400 });
      }
    }

    if (type === "ORG") {
      if (!user.isSuperAdmin && user.level !== 1) {
        return NextResponse.json({ error: "Only top-level users can create org calendars" }, { status: 403 });
      }
      const existing = await prisma.calendarCollection.findFirst({
        where: { companyId: user.companyId, type: "ORG", isArchived: false },
      });
      if (existing) return NextResponse.json({ error: "Org calendar already exists" }, { status: 400 });
    }

    let contentChannel: string | null = null;
    let contentPlatformPreset: ContentPlatformPresetId | null = null;
    if (type === "CHANNEL" && rawPreset && isValidPresetId(rawPreset)) {
      contentPlatformPreset = rawPreset;
      if (rawPreset === "custom") {
        contentChannel = rawChannelLabel;
      } else {
        const preset = getContentPlatformPreset(rawPreset);
        contentChannel = preset ? preset.label.slice(0, 64) : null;
      }
    }

    const created = await prisma.calendarCollection.create({
      data: {
        companyId: user.companyId,
        ownerUserId: type === "PERSONAL" ? user.userId : null,
        name,
        color,
        type,
        ...(type === "CHANNEL" && contentChannel ? { contentChannel } : {}),
        ...(type === "CHANNEL" && contentPlatformPreset ? { contentPlatformPreset } : {}),
      },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create calendar" }, { status: 500 });
  }
}
