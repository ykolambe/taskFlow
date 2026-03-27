import { NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { resolveTenantRuntimeBySlug } from "@/lib/tenantRuntime";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const { slug } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runtime = await resolveTenantRuntimeBySlug(slug);
  if (!runtime) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: runtime });
}

