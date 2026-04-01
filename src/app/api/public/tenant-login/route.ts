import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { authSessionCookieOptions } from "@/lib/authCookies";
import bcrypt from "bcryptjs";
import { takePublicRateLimit, clientKeyFromRequest } from "@/lib/publicRateLimit";

async function passwordMatches(plain: string, hash: string): Promise<boolean> {
  if (!hash || typeof hash !== "string") return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const key = `tenant-login:${clientKeyFromRequest(req)}`;
  if (!takePublicRateLimit(key, 40, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    let body: Record<string, unknown>;
    try {
      const raw = await req.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      body = raw as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
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
      if (await passwordMatches(password, u.passwordHash)) {
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
      isSuperAdmin: Boolean(user.isSuperAdmin),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      chatAddonAccess: Boolean(user.chatAddonAccess),
      recurringAddonAccess: Boolean(user.recurringAddonAccess),
      aiAddonAccess: Boolean(user.aiAddonAccess),
    });

    const res = NextResponse.json({
      success: true,
      slug,
      redirectTo: `/t/${slug}/dashboard`,
    });
    res.cookies.set(`tenant_${slug}_token`, token, authSessionCookieOptions(req));
    return res;
  } catch (e) {
    if (e instanceof PrismaClientInitializationError) {
      console.error("tenant-login: database unavailable:", e.message);
      return NextResponse.json(
        { error: "Service temporarily unavailable. Check DATABASE_URL and that PostgreSQL is running." },
        { status: 503 }
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("tenant-login: Prisma error", e.code, e.message);
    } else {
      console.error("tenant-login:", e);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
