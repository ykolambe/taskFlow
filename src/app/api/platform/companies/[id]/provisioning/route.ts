import { NextRequest, NextResponse } from "next/server";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProvisioningAction } from "@prisma/client";
import { enqueueProvisioningJob } from "@/lib/tenantProvisioning";

type Params = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [infra, jobs] = await Promise.all([
    prisma.tenantInfraConfig.findUnique({ where: { companyId: id } }),
    prisma.tenantProvisioningJob.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ success: true, data: { infra, jobs } });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const actionRaw = String(body.action ?? "PROVISION").toUpperCase();
  const action =
    actionRaw === "REPROVISION"
      ? ProvisioningAction.REPROVISION
      : actionRaw === "VALIDATE"
      ? ProvisioningAction.VALIDATE
      : ProvisioningAction.PROVISION;

  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined;
  const job = await enqueueProvisioningJob(id, action, body.payload ?? undefined, idempotencyKey);
  return NextResponse.json({ success: true, data: job }, { status: 202 });
}

