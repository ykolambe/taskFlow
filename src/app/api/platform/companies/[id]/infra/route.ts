import { NextRequest, NextResponse } from "next/server";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeploymentMode, ProvisioningStatus, type TenantInfraConfig } from "@prisma/client";

type Params = { params: Promise<{ id: string }> | { id: string } };

function sanitizeInfraResponse(row: TenantInfraConfig) {
  const { geminiApiKeyPlatform: _p, geminiApiKeyTenant: _t, ...rest } = row;
  return {
    ...rest,
    hasGeminiApiKeyPlatform: Boolean(_p?.trim()),
    hasGeminiApiKeyTenant: Boolean(_t?.trim()),
  };
}

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const infra = await prisma.tenantInfraConfig.findUnique({
    where: { companyId: id },
  });
  if (!infra) return NextResponse.json({ success: true, data: null });
  return NextResponse.json({ success: true, data: sanitizeInfraResponse(infra) });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const deploymentModeRaw = String(body.deploymentMode ?? "SHARED").toUpperCase();
  const deploymentMode = deploymentModeRaw === "DEDICATED" ? DeploymentMode.DEDICATED : DeploymentMode.SHARED;

  const bodyRecord = body as Record<string, unknown>;
  const geminiPlatformUpdate =
    "geminiApiKeyPlatform" in bodyRecord
      ? {
          geminiApiKeyPlatform:
            bodyRecord.geminiApiKeyPlatform === null ||
            bodyRecord.geminiApiKeyPlatform === undefined ||
            bodyRecord.geminiApiKeyPlatform === ""
              ? null
              : String(bodyRecord.geminiApiKeyPlatform).trim() || null,
        }
      : {};

  const infra = await prisma.tenantInfraConfig.upsert({
    where: { companyId: id },
    update: {
      deploymentMode,
      backendBaseUrl: body.backendBaseUrl ?? null,
      backendIp: body.backendIp ?? null,
      frontendBaseUrl: body.frontendBaseUrl ?? null,
      frontendIp: body.frontendIp ?? null,
      dbHost: body.dbHost ?? null,
      dbPort: body.dbPort ?? null,
      dbName: body.dbName ?? null,
      dbUserSecretRef: body.dbUserSecretRef ?? null,
      dbPasswordSecretRef: body.dbPasswordSecretRef ?? null,
      dbUrlSecretRef: body.dbUrlSecretRef ?? null,
      aiProvider: body.aiProvider ?? null,
      aiModel: body.aiModel ?? null,
      aiApiKeySecretRef: body.aiApiKeySecretRef ?? null,
      aiBaseUrl: body.aiBaseUrl ?? null,
      aiRequestBudgetDaily: body.aiRequestBudgetDaily ?? null,
      provisioningStatus: ProvisioningStatus.PENDING,
      provisioningError: null,
      ...geminiPlatformUpdate,
    },
    create: {
      companyId: id,
      deploymentMode,
      backendBaseUrl: body.backendBaseUrl ?? null,
      backendIp: body.backendIp ?? null,
      frontendBaseUrl: body.frontendBaseUrl ?? null,
      frontendIp: body.frontendIp ?? null,
      dbHost: body.dbHost ?? null,
      dbPort: body.dbPort ?? null,
      dbName: body.dbName ?? null,
      dbUserSecretRef: body.dbUserSecretRef ?? null,
      dbPasswordSecretRef: body.dbPasswordSecretRef ?? null,
      dbUrlSecretRef: body.dbUrlSecretRef ?? null,
      aiProvider: body.aiProvider ?? null,
      aiModel: body.aiModel ?? null,
      aiApiKeySecretRef: body.aiApiKeySecretRef ?? null,
      aiBaseUrl: body.aiBaseUrl ?? null,
      aiRequestBudgetDaily: body.aiRequestBudgetDaily ?? null,
      provisioningStatus: ProvisioningStatus.PENDING,
      ...("geminiApiKeyPlatform" in bodyRecord
        ? {
            geminiApiKeyPlatform:
              bodyRecord.geminiApiKeyPlatform === null ||
              bodyRecord.geminiApiKeyPlatform === undefined ||
              bodyRecord.geminiApiKeyPlatform === ""
                ? null
                : String(bodyRecord.geminiApiKeyPlatform).trim() || null,
          }
        : {}),
    },
  });

  return NextResponse.json({ success: true, data: sanitizeInfraResponse(infra) });
}

