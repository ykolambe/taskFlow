import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
