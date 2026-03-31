import { createHash, randomInt } from "crypto";
import { SignJWT, jwtVerify } from "jose";

const PURPOSE = "workspace_signup_email";

function getSecret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "fallback-dev-secret-please-change"
  );
}

export function hashWorkspaceSignupOtp(email: string, code: string): string {
  const secret = process.env.JWT_SECRET || "fallback-dev-secret-please-change";
  return createHash("sha256")
    .update(`${secret}:${email.toLowerCase().trim()}:${code.trim()}`, "utf8")
    .digest("hex");
}

export function generateSixDigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function signWorkspaceSignupEmailToken(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  return new SignJWT({ purpose: PURPOSE, email: normalized })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

export async function verifyWorkspaceSignupEmailToken(token: string): Promise<{ email: string }> {
  const { payload } = await jwtVerify(token, getSecret());
  const p = payload as Record<string, unknown>;
  if (p.purpose !== PURPOSE || typeof p.email !== "string") {
    throw new Error("Invalid verification token");
  }
  return { email: p.email.toLowerCase().trim() };
}
