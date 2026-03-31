import type { NextRequest } from "next/server";

/**
 * Absolute origin for links in emails and Stripe redirects (no trailing slash).
 */
export function getPublicAppOrigin(req: NextRequest | null): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (typeof process.env.VERCEL_URL === "string" ? `https://${process.env.VERCEL_URL}` : null);
  if (env) return env.replace(/\/$/, "");

  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
