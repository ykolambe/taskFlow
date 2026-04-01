import type { NextRequest } from "next/server";
import { getSessionMaxAgeSeconds } from "@/lib/sessionDuration";

/**
 * Whether auth session cookies should use the Secure attribute.
 * - Production builds always use Secure.
 * - In development, use Secure when the client connected over HTTPS (ngrok, Cloudflare Tunnel, etc.)
 *   via x-forwarded-proto or the request URL.
 * Optional override: COOKIE_SECURE=true | false
 *
 * Plain HTTP (e.g. http://IP:3000) cannot persist Secure cookies; browsers drop Set-Cookie.
 * Use HTTPS in production, or set COOKIE_SECURE=false only for trusted HTTP test deployments.
 */
export function shouldUseSecureAuthCookies(req: NextRequest): boolean {
  const override = process.env.COOKIE_SECURE?.toLowerCase();
  if (override === "false" || override === "0") return false;
  if (override === "true" || override === "1") return true;

  if (process.env.NODE_ENV === "production") return true;

  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwarded === "https") return true;

  if (req.headers.get("x-forwarded-ssl") === "on") return true;

  try {
    if (req.nextUrl.protocol === "https:") return true;
  } catch {
    // ignore
  }

  return false;
}

/** Options for platform_token and tenant_*_token cookies. */
export function authSessionCookieOptions(req: NextRequest) {
  return {
    httpOnly: true as const,
    secure: shouldUseSecureAuthCookies(req),
    sameSite: "lax" as const,
    maxAge: getSessionMaxAgeSeconds(),
    path: "/",
  };
}
