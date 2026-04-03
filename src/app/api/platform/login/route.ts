import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { authSessionCookieOptions } from "@/lib/authCookies";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const emailTrim = email.trim();
    const owner = await prisma.platformOwner.findFirst({
      where: { email: { equals: emailTrim, mode: "insensitive" } },
    });
    if (!owner) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, owner.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signToken({
      type: "platform",
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set("platform_token", token, authSessionCookieOptions(req));

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
