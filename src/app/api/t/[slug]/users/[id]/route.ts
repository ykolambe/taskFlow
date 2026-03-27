import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePassword } from "@/lib/utils";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const target = await prisma.user.findUnique({
    where: { id },
    include: { roleLevel: true, children: { include: { roleLevel: true } } },
  });
  if (!target || target.companyId !== user.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: target });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const target = await prisma.user.findUnique({ where: { id }, include: { roleLevel: true } });
  if (!target || target.companyId !== currentUser.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!currentUser.isSuperAdmin && currentUser.userId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { firstName, lastName, isActive, roleLevelId, parentId, aiLeaderQaEnabled, isSuperAdmin } = body;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(isActive !== undefined && currentUser.isSuperAdmin && { isActive }),
      ...(Object.prototype.hasOwnProperty.call(body, "roleLevelId") &&
        currentUser.isSuperAdmin && { roleLevelId: roleLevelId || null }),
      ...(parentId !== undefined && currentUser.isSuperAdmin && { parentId }),
      ...(aiLeaderQaEnabled !== undefined &&
        currentUser.isSuperAdmin && { aiLeaderQaEnabled: Boolean(aiLeaderQaEnabled) }),
      ...(isSuperAdmin !== undefined && currentUser.isSuperAdmin && { isSuperAdmin: Boolean(isSuperAdmin) }),
    },
    include: { roleLevel: true },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser || !currentUser.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser || !currentUser.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.companyId !== currentUser.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const password = generatePassword(12);
  const target = await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });

  return NextResponse.json({
    success: true,
    password,
    email: target.email,
    username: target.username,
  });
}
