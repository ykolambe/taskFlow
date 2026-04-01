import { NextResponse } from "next/server";
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

/**
 * Per-tenant Web App Manifest. Linked from tenant layout so Add to Home Screen
 * uses start_url / scope for this institute only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { name: true, isActive: true },
  });

  if (!company || !company.isActive) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const manifest: MetadataRoute.Manifest = {
    id: `/t/${slug}/`,
    name: `TaskFlow — ${company.name}`,
    short_name: company.name,
    description: `TaskFlow workspace for ${company.name}`,
    start_url: `/t/${slug}/login`,
    scope: `/t/${slug}/`,
    display: "standalone",
    background_color: "#101522",
    theme_color: "#101522",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/pwa-screenshot-wide.png",
        sizes: "924x530",
        type: "image/png",
        form_factor: "wide",
        label: "TaskFlow workspace desktop view",
      },
      {
        src: "/pwa-screenshot-mobile.png",
        sizes: "720x1280",
        type: "image/png",
        label: "TaskFlow workspace mobile view",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
