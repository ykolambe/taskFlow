import { NextRequest, NextResponse } from "next/server";
import { DeploymentMode, ProvisioningStatus } from "@prisma/client";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> | { slug: string } };

/**
 * Super admin only. Read whether a tenant Gemini override exists (never returns raw keys).
 */
export async function GET(_: NextRequest, { params }: Params) {
  const { slug } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const company = await prisma.company.findUnique({
    where: { slug },
    select: {
      id: true,
      billing: { select: { aiAddonEnabled: true } },
      infraConfig: {
        select: { geminiApiKeyTenant: true, geminiApiKeyPlatform: true },
      },
    },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  return NextResponse.json({
    success: true,
    data: {
      aiAddonEnabled: company.billing?.aiAddonEnabled ?? false,
      hasTenantGeminiKey: Boolean(company.infraConfig?.geminiApiKeyTenant?.trim()),
      hasPlatformGeminiKey: Boolean(company.infraConfig?.geminiApiKeyPlatform?.trim()),
    },
  });
}

/**
 * Super admin only. Set or clear tenant-owned Gemini API key (overrides platform key when set).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, billing: { select: { aiAddonEnabled: true } } },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (!company.billing?.aiAddonEnabled) {
    return NextResponse.json({ error: "AI add-on is not enabled for this workspace." }, { status: 403 });
  }

  let body: { geminiApiKeyTenant?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!("geminiApiKeyTenant" in body)) {
    return NextResponse.json({ error: "geminiApiKeyTenant is required (use null to clear)" }, { status: 400 });
  }

  const raw = body.geminiApiKeyTenant;
  const nextValue =
    raw === null || raw === undefined || raw === ""
      ? null
      : typeof raw === "string"
        ? raw.trim().slice(0, 2048) || null
        : null;

  await prisma.tenantInfraConfig.upsert({
    where: { companyId: company.id },
    update: { geminiApiKeyTenant: nextValue },
    create: {
      companyId: company.id,
      deploymentMode: DeploymentMode.SHARED,
      provisioningStatus: ProvisioningStatus.PENDING,
      geminiApiKeyTenant: nextValue,
    },
  });

  return NextResponse.json({
    success: true,
    data: { hasTenantGeminiKey: Boolean(nextValue) },
  });
}
