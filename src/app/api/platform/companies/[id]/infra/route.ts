import { NextRequest, NextResponse } from "next/server";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeploymentMode, ProvisioningStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const infra = await prisma.tenantInfraConfig.findUnique({
    where: { companyId: id },
  });
  return NextResponse.json({ success: true, data: infra });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const deploymentModeRaw = String(body.deploymentMode ?? "SHARED").toUpperCase();
  const deploymentMode = deploymentModeRaw === "DEDICATED" ? DeploymentMode.DEDICATED : DeploymentMode.SHARED;

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
    },
  });

  return NextResponse.json({ success: true, data: infra });
}

