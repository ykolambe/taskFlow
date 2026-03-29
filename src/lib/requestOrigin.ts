import type { NextRequest } from "next/server";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** True if URL hostname is loopback / localhost (not a public deployment hostname). */
export function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "[::1]"
    );
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

/**
 * Scheme + host (+ port) for the inbound request (ngrok, reverse proxy, or direct).
 */
export function getRequestPublicOrigin(req: NextRequest): string {
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    req.headers.get("host") ??
    req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() ??
    (req.nextUrl.protocol === "https:" ? "https" : "http");
  return `${proto}://${host}`;
}

/**
 * Base URL for new tenant infra: explicit SHARED_* wins; then NEXTAUTH_URL if non-local;
 * if NEXTAUTH_URL is still localhost but the client hit a public origin, use the request.
 */
export function resolveTenantPublicBaseUrl(
  req: NextRequest,
  sharedEnv: string | undefined,
  nextAuthEnv: string | undefined,
  devFallback: string
): string {
  const explicit = sharedEnv?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const nextAuth = nextAuthEnv?.trim();
  const origin = getRequestPublicOrigin(req);

  if (nextAuth && !isLocalhostUrl(nextAuth)) {
    return stripTrailingSlash(nextAuth);
  }
  if (nextAuth && isLocalhostUrl(nextAuth) && !isLocalhostUrl(origin)) {
    return stripTrailingSlash(origin);
  }
  if (nextAuth) {
    return stripTrailingSlash(nextAuth);
  }
  return stripTrailingSlash(origin || devFallback);
}
