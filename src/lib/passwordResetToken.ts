import { createHash, randomBytes } from "crypto";

const HOUR_MS = 60 * 60 * 1000;

export function generatePasswordResetSecret(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString("hex");
  const hash = hashResetToken(raw);
  const expiresAt = new Date(Date.now() + HOUR_MS);
  return { raw, hash, expiresAt };
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
