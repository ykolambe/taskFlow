import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getContentPlatformPreset, isValidPresetId } from "@/lib/contentPlatformPresets";

async function getAccessibleCalendar(id: string, companyId: string, userId: string) {
  return prisma.calendarCollection.findFirst({
    where: {
      id,
      companyId,
      isArchived: false,
      OR: [{ type: "ORG" }, { type: "CHANNEL" }, { ownerUserId: userId }],
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cal = await getAccessibleCalendar(id, user.companyId, user.userId);
  if (!cal) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const color = typeof body?.color === "string" ? body.color : undefined;
  const rawPreset =
    body?.contentPlatformPreset !== undefined
      ? typeof body.contentPlatformPreset === "string"
        ? body.contentPlatformPreset.trim().toLowerCase()
        : ""
      : undefined;
  const rawChannelLabel =
    body?.contentChannel !== undefined
      ? typeof body.contentChannel === "string"
        ? body.contentChannel.trim().slice(0, 64)
        : undefined
      : undefined;

  if ((cal.type === "ORG" || cal.type === "CHANNEL") && !user.isSuperAdmin && user.level !== 1) {
    return NextResponse.json({ error: "Only top-level users can edit this shared calendar" }, { status: 403 });
  }
  if (cal.type === "PERSONAL" && cal.ownerUserId !== user.userId) {
    return NextResponse.json({ error: "Only owner can edit personal calendar" }, { status: 403 });
  }

  const data: {
    name?: string;
    color?: string;
    contentPlatformPreset?: string | null;
    contentChannel?: string | null;
  } = {};
  if (name !== undefined) data.name = name;
  if (color !== undefined) data.color = color;

  if (cal.type === "CHANNEL" && rawPreset !== undefined) {
    if (!rawPreset) {
      return NextResponse.json({ error: "Platform cannot be empty" }, { status: 400 });
    }
    if (!isValidPresetId(rawPreset)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }
    if (rawPreset === "custom") {
      if (!rawChannelLabel) {
        return NextResponse.json({ error: "Custom channel requires a label" }, { status: 400 });
      }
      data.contentPlatformPreset = rawPreset;
      data.contentChannel = rawChannelLabel;
    } else {
      const preset = getContentPlatformPreset(rawPreset);
      data.contentPlatformPreset = rawPreset;
      data.contentChannel = preset ? preset.label.slice(0, 64) : null;
    }
  }
  if (cal.type === "CHANNEL" && rawPreset === undefined && rawChannelLabel !== undefined) {
    if (cal.contentPlatformPreset === "custom") {
      data.contentChannel = rawChannelLabel || null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.calendarCollection.update({
    where: { id },
    data,
  });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cal = await getAccessibleCalendar(id, user.companyId, user.userId);
  if (!cal) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });

  if ((cal.type === "ORG" || cal.type === "CHANNEL") && !user.isSuperAdmin && user.level !== 1) {
    return NextResponse.json({ error: "Only top-level users can archive this shared calendar" }, { status: 403 });
  }
  if (cal.type === "PERSONAL" && cal.ownerUserId !== user.userId) {
    return NextResponse.json({ error: "Only owner can archive personal calendar" }, { status: 403 });
  }

  await prisma.calendarCollection.update({ where: { id }, data: { isArchived: true } });
  return NextResponse.json({ success: true });
}
