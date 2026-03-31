import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePassword } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { canAddSeat } from "@/lib/planEntitlements";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const users = await prisma.user.findMany({
    where: { companyId: company.id, isActive: true, isTenantBootstrapAccount: false },
    include: { roleLevel: true },
    orderBy: [{ firstName: "asc" }],
  });
  // Sort: super admins (no roleLevel) first, then by level asc, then by name
  users.sort((a, b) => {
    const la = a.roleLevel?.level ?? -1;
    const lb = b.roleLevel?.level ?? -1;
    if (la !== lb) return la - lb;
    return a.firstName.localeCompare(b.firstName);
  });

  return NextResponse.json({ success: true, data: users });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!currentUser.isSuperAdmin && currentUser.level > 1) {
    return NextResponse.json({ error: "You don't have permission to add users directly" }, { status: 403 });
  }

  try {
    const { firstName, lastName, email, username, roleLevelId, parentId } = await req.json();

    if (!firstName || !lastName || !email || !roleLevelId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const seatCheck = await canAddSeat(company.id);
    if (!seatCheck.ok) {
      return NextResponse.json({ error: seatCheck.reason }, { status: 403 });
    }

    const existing = await prisma.user.findFirst({ where: { email: email.toLowerCase(), companyId: company.id } });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

    const password = generatePassword(12);
    const finalUsername = username || `${firstName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;

    const newUser = await prisma.user.create({
      data: {
        companyId: company.id,
        roleLevelId,
        parentId: parentId || null,
        email: email.toLowerCase(),
        username: finalUsername,
        passwordHash: await bcrypt.hash(password, 12),
        firstName,
        lastName,
      },
      include: { roleLevel: true },
    });

    return NextResponse.json({
      success: true,
      data: newUser,
      credentials: { email: newUser.email, password, username: finalUsername },
    });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
