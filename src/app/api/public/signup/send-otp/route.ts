import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import {
  generateSixDigitOtp,
  hashWorkspaceSignupOtp,
} from "@/lib/workspaceSignupVerification";
import { takePublicRateLimit, clientKeyFromRequest } from "@/lib/publicRateLimit";

const bodySchema = z.object({
  email: z.string().email(),
});

const OTP_TTL_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (process.env.PUBLIC_SIGNUP_ENABLED !== "true") {
    return NextResponse.json({ error: "Self-service signup is not enabled" }, { status: 403 });
  }

  const ip = clientKeyFromRequest(req);
  if (!takePublicRateLimit(`signup-otp-send:${ip}`, 15, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many verification requests. Try again later." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  if (!takePublicRateLimit(`signup-otp-send-email:${email}`, 5, 60 * 60_000)) {
    return NextResponse.json(
      { error: "Too many codes sent to this address. Wait up to an hour or use a different email." },
      { status: 429 }
    );
  }

  const code = generateSixDigitOtp();
  const codeHash = hashWorkspaceSignupOtp(email, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.workspaceSignupOtp.upsert({
    where: { email },
    create: { email, codeHash, expiresAt, attempts: 0 },
    update: { codeHash, expiresAt, attempts: 0 },
  });

  const emailRes = await sendTransactionalEmail({
    to: email,
    subject: "Your TaskFlow workspace verification code",
    text: `Your verification code is: ${code}\n\nIt expires in 15 minutes. If you did not start workspace signup, ignore this email.`,
    html: `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:0.2em">${code}</p><p style="color:#64748b;font-size:14px">This code expires in 15 minutes.</p>`,
  });

  if (!emailRes.ok) {
    console.error("[signup/send-otp] email failed:", emailRes.error);
    return NextResponse.json(
      { error: emailRes.error || "Could not send verification email" },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, expiresInMinutes: 15 });
}
