import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { takePublicRateLimit, clientKeyFromRequest } from "@/lib/publicRateLimit";

const SLUG_RE = /^[a-z0-9-]+$/;

export async function GET(req: NextRequest) {
  const key = `slug-check:${clientKeyFromRequest(req)}`;
  if (!takePublicRateLimit(key, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get("slug")?.trim().toLowerCase() ?? "";
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const existing = await prisma.company.findUnique({ where: { slug } });
  return NextResponse.json({ available: !existing });
}
