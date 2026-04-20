import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

/** App root (this directory). Avoids Next inferring the wrong workspace when a parent folder has another package-lock.json. */
const appDir = path.dirname(fileURLToPath(import.meta.url));

const securityHeaders = (): { key: string; value: string }[] => {
  const isProd = process.env.NODE_ENV === "production";
  /**
   * Pragmatic CSP for Next.js App Router + Tailwind + next/font (Google) + SW + LAN Capacitor (http:).
   * Tighten further (nonces, drop unsafe-eval) when tooling allows.
   */
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' http: https: wss:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'self'",
  ].join("; ");

  const headers: { key: string; value: string }[] = [
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    { key: "Content-Security-Policy", value: csp },
  ];

  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
};

const nextConfig: NextConfig = {
  outputFileTracingRoot: appDir,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
    ];
  },
  // Hide the Next.js dev route indicator (the “N” in the corner). In dev it defaults to
  // bottom-left and sits on top of the tenant sidebar user avatar, looking like a broken profile photo.
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
    localPatterns: [
      { pathname: "/uploads/**" },
      { pathname: "/avatars/**" },
      { pathname: "/logos/**" },
      { pathname: "/attachments/**" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
