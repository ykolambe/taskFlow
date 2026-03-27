import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { authSessionCookieOptions } from "@/lib/authCookies";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: "Identifier and password required" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    if (!company.isActive) return NextResponse.json({ error: "This workspace is currently inactive" }, { status: 403 });

    const user = await prisma.user.findFirst({
      where: {
        companyId: company.id,
        OR: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }],
        isActive: true,
      },
      include: { roleLevel: true },
    });

    if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    // Super admins may have no role level — they sit outside the org hierarchy.
    // Use level 0 so hierarchy comparisons always treat them as "above everyone".
    const token = await signToken({
      type: "tenant",
      userId: user.id,
      companyId: company.id,
      companySlug: slug,
      roleLevelId: user.roleLevelId ?? null,
      level: user.roleLevel?.level ?? 0,
      isSuperAdmin: user.isSuperAdmin,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });

    const res = NextResponse.json({ success: true, firstName: user.firstName, lastName: user.lastName });
    res.cookies.set(`tenant_${slug}_token`, token, authSessionCookieOptions(req));

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
