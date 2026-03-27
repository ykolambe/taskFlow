import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isModuleEnabledForCompany } from "@/lib/tenantRuntime";

type Params = { params: Promise<{ slug: string }> | { slug: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
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

  // For V1 we expose all GLOBAL channels and any ROLE channels whose roleLevel is at/above the viewer
  const viewerRow = await prisma.user.findUnique({
    where: { id: viewer.userId },
    select: { roleLevel: { select: { level: true } } },
  });
  const viewerLevel = viewerRow?.roleLevel?.level ?? 999;

  const channels = await prisma.channel.findMany({
    where: {
      companyId: company.id,
      OR: [
        { type: "GLOBAL" },
        { type: "CUSTOM" },
        { type: "ROLE", roleLevel: { level: { gte: viewerLevel } } },
      ],
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ success: true, data: channels });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isModuleEnabledForCompany(company.id, "chat"))) {
    return NextResponse.json({ error: "Chat module is disabled for this tenant." }, { status: 403 });
  }

  let body: { slug?: string; name?: string; type?: string; roleLevelId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slugRaw = (body.slug ?? "").trim().toLowerCase();
  const nameRaw = (body.name ?? "").trim();
  const typeRaw = (body.type ?? "GLOBAL").toUpperCase();

  if (!slugRaw || !nameRaw) {
    return NextResponse.json({ error: "Slug and name are required" }, { status: 400 });
  }
  if (!/^[a-z0-9_-]+$/.test(slugRaw)) {
    return NextResponse.json({ error: "Slug can only contain letters, numbers, hyphens, and underscores" }, { status: 400 });
  }
  if (!["GLOBAL", "CUSTOM", "ROLE"].includes(typeRaw)) {
    return NextResponse.json({ error: "Invalid channel type" }, { status: 400 });
  }

  let roleLevelId: string | null = null;
  if (typeRaw === "ROLE") {
    roleLevelId = body.roleLevelId ?? null;
    if (!roleLevelId) {
      return NextResponse.json({ error: "roleLevelId is required for ROLE channels" }, { status: 400 });
    }
    const exists = await prisma.roleLevel.findFirst({
      where: { id: roleLevelId, companyId: company.id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Role level not found for this company" }, { status: 400 });
    }
  }

  const existing = await prisma.channel.findFirst({
    where: { companyId: company.id, slug: slugRaw },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Channel slug already exists for this company" }, { status: 400 });
  }

  const channel = await prisma.channel.create({
    data: {
      companyId: company.id,
      slug: slugRaw,
      name: nameRaw,
      type: typeRaw as any,
      roleLevelId,
    },
  });

  return NextResponse.json({ success: true, data: channel }, { status: 201 });
}

