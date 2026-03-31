import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { hashResetToken } from "@/lib/passwordResetToken";
import { takePublicRateLimit, clientKeyFromRequest } from "@/lib/publicRateLimit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const key = `reset-pw:${clientKeyFromRequest(req)}`;
  if (!takePublicRateLimit(key, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { slug } = await params;
    const { token, newPassword } = await req.json();

    if (!token || typeof token !== "string" || !newPassword || typeof newPassword !== "string") {
      return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const tokenHash = hashResetToken(token.trim());

    const record = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
        user: { companyId: company.id },
      },
      include: { user: true },
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
