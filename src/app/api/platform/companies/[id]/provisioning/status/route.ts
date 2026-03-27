import { NextRequest, NextResponse } from "next/server";
import { ProvisioningAction, ProvisioningStatus } from "@prisma/client";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const statusRaw = String(body.status ?? "").toUpperCase();
  const status =
    statusRaw === "PROVISIONING"
      ? ProvisioningStatus.PROVISIONING
      : statusRaw === "READY"
      ? ProvisioningStatus.READY
      : statusRaw === "FAILED"
      ? ProvisioningStatus.FAILED
      : statusRaw === "PENDING"
      ? ProvisioningStatus.PENDING
      : null;
  if (!status) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const errorText = body.error === undefined || body.error === null ? null : String(body.error).trim() || null;

  const [infra] = await prisma.$transaction([
    prisma.tenantInfraConfig.upsert({
      where: { companyId: id },
      update: {
        provisioningStatus: status,
        provisioningError: status === ProvisioningStatus.FAILED ? errorText ?? "Manually marked as failed" : errorText,
      },
      create: {
        companyId: id,
        provisioningStatus: status,
        provisioningError: status === ProvisioningStatus.FAILED ? errorText ?? "Manually marked as failed" : errorText,
      },
    }),
  ]);

  const latestJob = await prisma.tenantProvisioningJob.findFirst({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (latestJob) {
    await prisma.tenantProvisioningJob.update({
      where: { id: latestJob.id },
      data: {
        status,
        lastError: status === ProvisioningStatus.FAILED ? errorText ?? "Manually marked as failed" : null,
        ...(status === ProvisioningStatus.PROVISIONING ? { startedAt: new Date(), finishedAt: null } : {}),
        ...(status === ProvisioningStatus.READY || status === ProvisioningStatus.FAILED ? { finishedAt: new Date() } : {}),
      },
    });
  } else {
    await prisma.tenantProvisioningJob.create({
      data: {
        companyId: id,
        action: ProvisioningAction.VALIDATE,
        status,
        payload: { source: "manual_status_override" },
        lastError: status === ProvisioningStatus.FAILED ? errorText ?? "Manually marked as failed" : null,
        ...(status === ProvisioningStatus.PROVISIONING ? { startedAt: new Date() } : {}),
        ...(status === ProvisioningStatus.READY || status === ProvisioningStatus.FAILED ? { finishedAt: new Date() } : {}),
      },
    });
  }

  return NextResponse.json({ success: true, data: infra });
}

