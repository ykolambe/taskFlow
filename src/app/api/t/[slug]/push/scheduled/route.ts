import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.scheduledPush.findMany({
    where: {
      companyId: company.id,
      createdByTenantUserId: { not: null },
    },
    orderBy: { scheduledAt: "desc" },
    take: 50,
    select: {
      id: true,
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { title?: string; body?: string; targetPath?: string; scheduledAt?: string };
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

  let targetPath = (body.targetPath || `/t/${slug}/dashboard`).trim();
  if (!targetPath.startsWith("/")) targetPath = `/${targetPath}`;

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "scheduledAt must be a valid ISO date" }, { status: 400 });
  }
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "scheduledAt must be in the future" }, { status: 400 });
  }

  const row = await prisma.scheduledPush.create({
    data: {
      companyId: company.id,
      title,
      body: text,
      targetPath,
      scheduledAt,
      createdByTenantUserId: user.userId,
    },
  });

  return NextResponse.json({ success: true, data: row });
}
