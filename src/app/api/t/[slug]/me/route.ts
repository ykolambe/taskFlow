import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userData = await prisma.user.findUnique({ where: { id: user.userId }, include: { roleLevel: true } });
  return NextResponse.json({ success: true, data: userData });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { currentPassword, newPassword, firstName, lastName, avatarUrl, bio, phone } = await req.json();

    const existing = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (newPassword) {
      if (!currentPassword) return NextResponse.json({ error: "Current password required" }, { status: 400 });
      const valid = await bcrypt.compare(currentPassword, existing.passwordHash);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      if (newPassword.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      await prisma.user.update({ where: { id: user.userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
      return NextResponse.json({ success: true, message: "Password updated" });
    }

    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(bio !== undefined && { bio: bio || null }),
        ...(phone !== undefined && { phone: phone || null }),
      },
      include: { roleLevel: true },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
