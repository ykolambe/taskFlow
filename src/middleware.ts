import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || "fallback-dev-secret-please-change"
  );

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

  // Handle x.localhost pattern
  if (withoutPort.endsWith(".localhost")) {
    return withoutPort.replace(".localhost", "");
  }

  return null;
}

async function verifyJwt(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "localhost:3000";
  const rootDomain = process.env.ROOT_DOMAIN || "localhost:3000";

  // Skip static uploads and anything that looks like a file path. Middleware runs
  // before static/route handlers on some stacks — excluding these prefixes avoids
  // auth/subdomain logic touching public files (fixes new uploads 404 on HTTP/IP).
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

  // ── Subdomain → rewrite to /t/[slug] ──────────────────────────────
  const subdomain = getSubdomain(hostname, rootDomain);

  if (subdomain && !pathname.startsWith("/t/") && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/t/${subdomain}${pathname === "/" ? "" : pathname}`;
    if (!url.pathname.endsWith("/")) {
      // keep as-is
    }
    return NextResponse.rewrite(url);
  }

  // ── Platform routes auth ───────────────────────────────────────────
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

  // ── Tenant routes auth ─────────────────────────────────────────────
  const tenantMatch = pathname.match(/^\/t\/([^/]+)(\/.*)?$/);
  if (tenantMatch) {
    const slug = tenantMatch[1];
    const subPath = tenantMatch[2] || "/";

    // Allow login page without auth
    if (subPath === "/login" || subPath === "/login/") {
      return NextResponse.next();
    }

    // Root of tenant → redirect to dashboard or login
    if (subPath === "/" || subPath === "") {
      const token = request.cookies.get(`tenant_${slug}_token`)?.value;
      if (!token) {
        return NextResponse.redirect(new URL(`/t/${slug}/login`, request.url));
      }
      return NextResponse.redirect(new URL(`/t/${slug}/dashboard`, request.url));
    }

    // Protected tenant routes
    const token = request.cookies.get(`tenant_${slug}_token`)?.value;
    if (!token) {
      return NextResponse.redirect(new URL(`/t/${slug}/login`, request.url));
    }
    try {
      const payload = await verifyJwt(token);
      if ((payload as { type?: string }).type !== "tenant") {
        return NextResponse.redirect(new URL(`/t/${slug}/login`, request.url));
      }
    } catch {
      const res = NextResponse.redirect(new URL(`/t/${slug}/login`, request.url));
      res.cookies.delete(`tenant_${slug}_token`);
      return res;
    }
  }

  // ── Root → redirect to platform login ─────────────────────────────
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/platform/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Do not run middleware for public upload dirs or file-like paths — lets
     * /attachments, /logos, etc. reach Route Handlers or static files without
     * subdomain/auth interference.
     */
    "/((?!_next/static|_next/image|favicon.ico|uploads/|attachments/|avatars/|logos/|api/).*)",
  ],
};
