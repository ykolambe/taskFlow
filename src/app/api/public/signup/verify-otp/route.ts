import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashWorkspaceSignupOtp, signWorkspaceSignupEmailToken } from "@/lib/workspaceSignupVerification";
import { takePublicRateLimit, clientKeyFromRequest } from "@/lib/publicRateLimit";

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

const MAX_ATTEMPTS = 8;

export async function POST(req: NextRequest) {
  if (process.env.PUBLIC_SIGNUP_ENABLED !== "true") {
    return NextResponse.json({ error: "Self-service signup is not enabled" }, { status: 403 });
  }

  const ip = clientKeyFromRequest(req);
  if (!takePublicRateLimit(`signup-otp-verify:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code or email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const code = parsed.data.code;

  const row = await prisma.workspaceSignupOtp.findUnique({ where: { email } });
  if (!row) {
    return NextResponse.json({ error: "No code found. Send a new code first." }, { status: 400 });
  }

  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.workspaceSignupOtp.delete({ where: { email } }).catch(() => {});
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many wrong attempts. Request a new code." },
      { status: 400 }
    );
  }

  const expectedHash = hashWorkspaceSignupOtp(email, code);
  if (expectedHash !== row.codeHash) {
    await prisma.workspaceSignupOtp.update({
      where: { email },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  await prisma.workspaceSignupOtp.delete({ where: { email } });

  const emailVerificationToken = await signWorkspaceSignupEmailToken(email);
  return NextResponse.json({ ok: true, emailVerificationToken });
}
