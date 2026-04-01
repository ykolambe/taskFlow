import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { authSessionCookieOptions } from "@/lib/authCookies";
import { getJwtExpirationDurationString, getSessionMaxAgeSeconds } from "@/lib/sessionDuration";

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || "fallback-dev-secret-please-change"
  );

/** Tolerate phone/desktop clock skew so valid sessions are not dropped on every cold start. */
const JWT_CLOCK_TOLERANCE_SEC = 120;

function getSubdomain(hostname: string, rootDomain: string): string | null {
  if (
    hostname === rootDomain ||
    hostname === `www.${rootDomain}` ||
    hostname === "localhost" ||
    hostname === "localhost:3000"
  ) {
    return null;
  }

  const withoutPort = hostname.split(":")[0];
  const rootWithoutPort = rootDomain.split(":")[0];

  if (withoutPort.endsWith(`.${rootWithoutPort}`)) {
    return withoutPort.replace(`.${rootWithoutPort}`, "");
  }

  if (withoutPort.endsWith(".localhost")) {
    return withoutPort.replace(".localhost", "");
  }

  return null;
}

async function verifyJwt(token: string) {
  const { payload } = await jwtVerify(token, getSecret(), {
    clockTolerance: JWT_CLOCK_TOLERANCE_SEC,
  });
  return payload;
}

function stripJwtStdClaims(p: JWTPayload): Record<string, unknown> {
  const o = { ...p } as Record<string, unknown>;
  delete o.exp;
  delete o.iat;
  delete o.nbf;
  return o;
}

/** Re-issue JWT when more than half the session lifetime has passed (keeps active PWA users signed in). */
async function maybeRefreshTenantSessionToken(payload: JWTPayload): Promise<string | null> {
  const exp = payload.exp;
  if (typeof exp !== "number") return null;
  const now = Math.floor(Date.now() / 1000);
  const ttl = exp - now;
  const maxSeconds = getSessionMaxAgeSeconds();
  if (ttl <= 0 || ttl >= maxSeconds * 0.5) return null;
  const claims = stripJwtStdClaims(payload);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(getJwtExpirationDurationString())
    .sign(getSecret());
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "localhost:3000";
  const rootDomain = process.env.ROOT_DOMAIN || "localhost:3000";

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/attachments") ||
    pathname.startsWith("/avatars") ||
    pathname.startsWith("/logos") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const subdomain = getSubdomain(hostname, rootDomain);

  if (subdomain && !pathname.startsWith("/t/") && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/t/${subdomain}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith("/platform") && !pathname.startsWith("/platform/login")) {
    const token = request.cookies.get("platform_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/platform/login", request.url));
    }
    try {
      const payload = await verifyJwt(token);
      if ((payload as { type?: string }).type !== "platform") {
        return NextResponse.redirect(new URL("/platform/login", request.url));
      }
    } catch {
      const res = NextResponse.redirect(new URL("/platform/login", request.url));
      res.cookies.delete("platform_token");
      return res;
    }
  }

  const tenantMatch = pathname.match(/^\/t\/([^/]+)(\/.*)?$/);
  if (tenantMatch) {
    const slug = tenantMatch[1];
    const subPath = tenantMatch[2] || "/";

    if (
      subPath === "/login" ||
      subPath === "/login/" ||
      subPath === "/forgot-password" ||
      subPath === "/forgot-password/" ||
      subPath === "/reset-password" ||
      subPath === "/reset-password/"
    ) {
      return NextResponse.next();
    }

    if (subPath === "/manifest" || subPath === "/manifest/") {
      return NextResponse.next();
    }

    const cookieName = `tenant_${slug}_token`;
    const loginUrl = new URL(`/t/${slug}/login`, request.url);

    const runTenantAuth = async (mode: "next" | "redirectDashboard"): Promise<NextResponse> => {
      const token = request.cookies.get(cookieName)?.value;
      if (!token) {
        return NextResponse.redirect(loginUrl);
      }
      let payload: JWTPayload;
      try {
        payload = await verifyJwt(token);
      } catch {
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete(cookieName);
        return res;
      }
      if ((payload as { type?: string }).type !== "tenant") {
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete(cookieName);
        return res;
      }

      const newToken = await maybeRefreshTenantSessionToken(payload);
      if (newToken) {
        if (mode === "next") {
          const res = NextResponse.next();
          res.cookies.set(cookieName, newToken, authSessionCookieOptions(request));
          return res;
        }
        const dash = new URL(`/t/${slug}/dashboard`, request.url);
        const res = NextResponse.redirect(dash);
        res.cookies.set(cookieName, newToken, authSessionCookieOptions(request));
        return res;
      }

      return mode === "next"
        ? NextResponse.next()
        : NextResponse.redirect(new URL(`/t/${slug}/dashboard`, request.url));
    };

    if (subPath === "/" || subPath === "") {
      return runTenantAuth("redirectDashboard");
    }

    return runTenantAuth("next");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads/|attachments/|avatars/|logos/|api/).*)",
  ],
};
