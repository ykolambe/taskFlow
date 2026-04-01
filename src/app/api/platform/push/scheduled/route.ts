import { NextRequest, NextResponse } from "next/server";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const owner = await getPlatformUser();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.scheduledPush.findMany({
    where: { createdByPlatformOwnerId: { not: null } },
    orderBy: { scheduledAt: "desc" },
    take: 50,
    select: {
      id: true,
      companyId: true,
      title: true,
      body: true,
      targetPath: true,
      scheduledAt: true,
      status: true,
      sentAt: true,
      recipientCount: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: NextRequest) {
  const owner = await getPlatformUser();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    title?: string;
    body?: string;
    targetPath?: string;
    scheduledAt?: string;
    companyId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  const text = body.body?.trim();
  if (!title || !text) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  let targetPath = (body.targetPath || "/platform/dashboard").trim();
  if (!targetPath.startsWith("/")) targetPath = `/${targetPath}`;

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "scheduledAt must be a valid ISO date" }, { status: 400 });
  }
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "scheduledAt must be in the future" }, { status: 400 });
  }

  const companyId = body.companyId === undefined || body.companyId === null || body.companyId === "" ? null : String(body.companyId);

  if (companyId) {
    const c = await prisma.company.findUnique({ where: { id: companyId } });
    if (!c) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const row = await prisma.scheduledPush.create({
    data: {
      companyId,
      title,
      body: text,
      targetPath,
      scheduledAt,
      createdByPlatformOwnerId: owner.id,
    },
  });

  return NextResponse.json({ success: true, data: row });
}
