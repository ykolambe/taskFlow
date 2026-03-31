import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser } from "@/lib/auth";
import { createTenantWorkspace } from "@/lib/tenantOnboarding";

export async function GET(req: NextRequest) {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, tasks: true } }, roleLevels: { orderBy: { level: "asc" } } },
  });

  return NextResponse.json({ success: true, data: companies });
}

export async function POST(req: NextRequest) {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, slug, roleLevels, modules } = await req.json();

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ error: "Slug can only contain lowercase letters, numbers, and hyphens" }, { status: 400 });
    }

    const existing = await prisma.company.findUnique({ where: { slug: String(slug).toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: "This slug is already taken" }, { status: 409 });
    }

    const result = await createTenantWorkspace({
      name,
      slug,
      modules,
      roleLevels,
      admin: { type: "platform_bootstrap" },
      req,
      provisioningJobSource: "company_create_auto",
    });

    const normalizedSlug = result.normalizedSlug;

    return NextResponse.json({
      success: true,
      company: result.company,
      credentials: {
        email: result.credentials.email,
        password: result.credentials.password,
        slug: normalizedSlug,
      },
      provisioning: result.provisioning,
      secretRefs: result.secretRefs,
    });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
