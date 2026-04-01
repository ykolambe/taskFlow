import type { NextRequest } from "next/server";
import { getSessionMaxAgeSeconds } from "@/lib/sessionDuration";

/**
 * Whether auth session cookies should use the Secure attribute.
 * Secure is derived from the **incoming request** (URL + proxy headers), not from NODE_ENV alone.
 * Otherwise production builds on plain HTTP (e.g. http://IP:3000) would set Secure cookies that
 * browsers refuse to store — PWA/browser would ask to log in on every cold start.
 *
 * Optional override: COOKIE_SECURE=true | false
 * Behind TLS-terminating proxies, ensure X-Forwarded-Proto: https is set so Secure is used.
 */
export function shouldUseSecureAuthCookies(req: NextRequest): boolean {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (override === "false" || override === "0" || override === "no" || override === "off") return false;
  if (override === "true" || override === "1" || override === "yes" || override === "on") return true;

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
  const maxAge = getSessionMaxAgeSeconds();
  return {
    httpOnly: true as const,
    secure: shouldUseSecureAuthCookies(req),
    sameSite: "lax" as const,
    maxAge,
    /** Some mobile/PWA stacks persist Expires more reliably than Max-Age alone */
    expires: new Date(Date.now() + maxAge * 1000),
    path: "/",
  };
}
