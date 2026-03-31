import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { getPublicAppOrigin } from "@/lib/publicAppUrl";
import { generatePasswordResetSecret, hashResetToken } from "@/lib/passwordResetToken";
import { takePublicRateLimit, clientKeyFromRequest } from "@/lib/publicRateLimit";

export async function POST(req: NextRequest) {
  const key = `forgot-pw:${clientKeyFromRequest(req)}`;
  if (!takePublicRateLimit(key, 10, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
      return NextResponse.json({ ok: true });
    }

    const users = await prisma.user.findMany({
      where: {
        email: { equals: email, mode: "insensitive" },
        isActive: true,
        company: { isActive: true },
      },
      include: { company: true },
    });

    const origin = getPublicAppOrigin(req);

    for (const user of users) {
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      const { raw, hash, expiresAt } = generatePasswordResetSecret();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hash,
          expiresAt,
        },
      });

      const link = `${origin}/t/${user.company.slug}/reset-password?token=${encodeURIComponent(raw)}`;

      const emailRes = await sendTransactionalEmail({
        to: user.email,
        subject: `Reset your TaskFlow password — ${user.company.name}`,
        text: `Reset your password for workspace "${user.company.name}":\n\n${link}\n\nThis link expires in one hour.`,
        html: `<p>Reset your password for workspace <strong>${escapeHtml(user.company.name)}</strong>.</p><p><a href="${link}">Set a new password</a></p><p>This link expires in one hour.</p>`,
      });
      if (!emailRes.ok) {
        console.error("[forgot-password] sendTransactionalEmail failed:", emailRes.error);
        return NextResponse.json(
          {
            error:
              emailRes.error ||
              "Email service is unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not send reset link" }, { status: 500 });
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
