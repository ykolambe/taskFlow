import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { authSessionCookieOptions } from "@/lib/authCookies";
import bcrypt from "bcryptjs";
import { takePublicRateLimit, clientKeyFromRequest } from "@/lib/publicRateLimit";

export async function POST(req: NextRequest) {
  const key = `tenant-login:${clientKeyFromRequest(req)}`;
  if (!takePublicRateLimit(key, 40, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const candidates = await prisma.user.findMany({
      where: {
        email: { equals: email, mode: "insensitive" },
        isActive: true,
        company: { isActive: true },
      },
      include: { company: true, roleLevel: true },
    });

    const matches = [];
    for (const u of candidates) {
      if (await bcrypt.compare(password, u.passwordHash)) {
        matches.push(u);
      }
    }

    if (matches.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (matches.length > 1) {
      return NextResponse.json({
        workspaces: matches.map((u) => ({
          slug: u.company.slug,
          name: u.company.name,
          companyId: u.company.id,
        })),
      });
    }

    const user = matches[0]!;
    const slug = user.company.slug;

    const token = await signToken({
      type: "tenant",
      userId: user.id,
      companyId: user.companyId,
      companySlug: slug,
      roleLevelId: user.roleLevelId ?? null,
      level: user.roleLevel?.level ?? 0,
      isSuperAdmin: user.isSuperAdmin,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      chatAddonAccess: user.chatAddonAccess,
      recurringAddonAccess: user.recurringAddonAccess,
      aiAddonAccess: user.aiAddonAccess,
    });

    const res = NextResponse.json({
      success: true,
      slug,
      redirectTo: `/t/${slug}/dashboard`,
    });
    res.cookies.set(`tenant_${slug}_token`, token, authSessionCookieOptions(req));
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
