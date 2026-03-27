import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/t/[slug]/company
 * Super admin only. Update organization name and/or logo URL (sidebar + org chart).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  const { slug } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  let body: { name?: string; logoUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { name?: string; logoUrl?: string | null } = {};
  if (body.name !== undefined && typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length > 0) data.name = name;
  }
  if (body.logoUrl !== undefined) {
    if (body.logoUrl === null || body.logoUrl === "") {
      data.logoUrl = null;
    } else if (typeof body.logoUrl === "string") {
      data.logoUrl = body.logoUrl.trim() || null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.company.update({
    where: { id: company.id },
    data,
  });

  return NextResponse.json({ success: true, data: updated });
}
