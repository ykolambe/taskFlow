import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser } from "@/lib/auth";
import { generatePassword } from "@/lib/utils";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { id },
    include: { roleLevels: { orderBy: { level: "asc" }, take: 1 } },
  });

  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const password = generatePassword(12);
  const email = `admin@${company.slug}.taskflow.local`;

  const topLevel = company.roleLevels[0];
  if (!topLevel) return NextResponse.json({ error: "No role levels defined" }, { status: 400 });

  const existing = await prisma.user.findFirst({
    where: { companyId: id, isSuperAdmin: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        roleLevelId: topLevel.id,
        isTenantBootstrapAccount: true,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        companyId: id,
        roleLevelId: topLevel.id,
        email,
        username: "admin",
        passwordHash: await bcrypt.hash(password, 12),
        firstName: "Super",
        lastName: "Admin",
        isSuperAdmin: true,
        isTenantBootstrapAccount: true,
      },
    });
  }

  return NextResponse.json({ success: true, email, password, slug: company.slug });
}
