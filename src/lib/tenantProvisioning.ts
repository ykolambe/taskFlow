import { Prisma, ProvisioningAction, ProvisioningStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { provisionTenantDatabase, validateTenantDatabaseConfig } from "@/lib/tenantDbProvisioning";

type ProvisioningStepLog = {
  at: string;
  step: string;
  status: "started" | "success" | "skipped" | "failed";
  message?: string;
};

function readStepLogs(payload: Prisma.JsonValue | null): ProvisioningStepLog[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const raw = (payload as { stepLogs?: unknown }).stepLogs;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => x as ProvisioningStepLog);
}

function shouldForceDbBootstrap(payload: Prisma.JsonValue | null): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  return Boolean((payload as { forceDbBootstrap?: unknown }).forceDbBootstrap);
}

async function appendJobStepLog(jobId: string, step: string, status: ProvisioningStepLog["status"], message?: string) {
  const job = await prisma.tenantProvisioningJob.findUnique({
    where: { id: jobId },
    select: { payload: true },
  });
  const logs = readStepLogs(job?.payload ?? null);
  logs.push({ at: new Date().toISOString(), step, status, ...(message ? { message } : {}) });
  await prisma.tenantProvisioningJob.update({
    where: { id: jobId },
    data: {
      payload: {
        ...(job?.payload && typeof job.payload === "object" && !Array.isArray(job.payload) ? (job.payload as object) : {}),
        stepLogs: logs,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function enqueueProvisioningJob(
  companyId: string,
  action: ProvisioningAction,
  payload?: Prisma.InputJsonValue,
  idempotencyKey?: string
) {
  if (idempotencyKey) {
    const existing = await prisma.tenantProvisioningJob.findFirst({
      where: {
        companyId,
        idempotencyKey,
        status: { in: [ProvisioningStatus.PENDING, ProvisioningStatus.PROVISIONING] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
  }

  await prisma.tenantInfraConfig.upsert({
    where: { companyId },
    update: {
      provisioningStatus: ProvisioningStatus.PENDING,
      provisioningError: null,
    },
    create: {
      companyId,
      provisioningStatus: ProvisioningStatus.PENDING,
    },
  });

  return prisma.tenantProvisioningJob.create({
    data: {
      companyId,
      action,
      status: ProvisioningStatus.PENDING,
      payload: payload ?? undefined,
      idempotencyKey: idempotencyKey ?? null,
    },
  });
}

async function executeProvisioningJob(jobId: string) {
  const claim = await prisma.tenantProvisioningJob.updateMany({
    where: {
      id: jobId,
      status: ProvisioningStatus.PENDING,
    },
    data: {
      status: ProvisioningStatus.PROVISIONING,
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
  if (claim.count === 0) return null;

  const job = await prisma.tenantProvisioningJob.findUnique({ where: { id: jobId } });
  if (!job) return null;

  try {
    await appendJobStepLog(job.id, "job_claimed", "success", "Job claimed and execution started");

    const infra = await prisma.tenantInfraConfig.update({
      where: { companyId: job.companyId },
      data: {
        provisioningStatus: ProvisioningStatus.PROVISIONING,
        provisioningError: null,
      },
    });
    await appendJobStepLog(job.id, "infra_marked_provisioning", "success");

    const shouldBootstrapDb =
      infra.deploymentMode === "DEDICATED" ||
      process.env.PROVISION_SHARED_DB_BOOTSTRAP === "true" ||
      shouldForceDbBootstrap(job.payload);

    if (job.action === ProvisioningAction.VALIDATE) {
      await appendJobStepLog(job.id, "dry_run_validation", "started", "Checking credentials/connectivity without mutation");
      const validation = await validateTenantDatabaseConfig({
        companyId: job.companyId,
        dbHost: infra.dbHost,
        dbPort: infra.dbPort,
        dbName: infra.dbName,
        dbUserSecretRef: infra.dbUserSecretRef,
        dbPasswordSecretRef: infra.dbPasswordSecretRef,
        dbUrlSecretRef: infra.dbUrlSecretRef,
      });
      await appendJobStepLog(
        job.id,
        "dry_run_validation",
        "success",
        `adminConnected=${validation.adminConnected}, databaseExists=${validation.databaseExists}, tenantConnected=${validation.tenantConnected}`
      );
    } else if (shouldBootstrapDb) {
      await appendJobStepLog(job.id, "db_bootstrap", "started", "Creating database if missing");
      await provisionTenantDatabase({
        companyId: job.companyId,
        dbHost: infra.dbHost,
        dbPort: infra.dbPort,
        dbName: infra.dbName,
        dbUserSecretRef: infra.dbUserSecretRef,
        dbPasswordSecretRef: infra.dbPasswordSecretRef,
        dbUrlSecretRef: infra.dbUrlSecretRef,
      });
      await appendJobStepLog(job.id, "db_bootstrap", "success", "DB created/ensured and schema applied");
    } else {
      await appendJobStepLog(
        job.id,
        "db_bootstrap",
        "skipped",
        "Skipped for shared mode (set PROVISION_SHARED_DB_BOOTSTRAP=true to enable)"
      );
    }

    await appendJobStepLog(job.id, "job_finalize", "started", "Marking provisioning as READY");
    await prisma.$transaction([
      prisma.tenantProvisioningJob.update({
        where: { id: job.id },
        data: {
          status: ProvisioningStatus.READY,
          finishedAt: new Date(),
          lastError: null,
        },
      }),
      prisma.tenantInfraConfig.update({
        where: { companyId: job.companyId },
        data: {
          provisioningStatus: ProvisioningStatus.READY,
          provisioningError: null,
        },
      }),
    ]);
    await appendJobStepLog(job.id, "job_finalize", "success");
    return { id: job.id, status: ProvisioningStatus.READY };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Provisioning failed";
    await appendJobStepLog(job.id, "job_error", "failed", msg.slice(0, 1000));
    const status = job.attempts + 1 >= job.maxAttempts ? ProvisioningStatus.FAILED : ProvisioningStatus.PENDING;

    await prisma.$transaction([
      prisma.tenantProvisioningJob.update({
        where: { id: job.id },
        data: {
          status,
          finishedAt: status === ProvisioningStatus.FAILED ? new Date() : null,
          lastError: msg.slice(0, 1000),
        },
      }),
      prisma.tenantInfraConfig.update({
        where: { companyId: job.companyId },
        data: {
          provisioningStatus: status,
          provisioningError: msg.slice(0, 1000),
        },
      }),
    ]);
    return { id: job.id, status };
  }
}

export async function processPendingProvisioningJobs(limit = 5) {
  const jobs = await prisma.tenantProvisioningJob.findMany({
    where: { status: ProvisioningStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 25)),
    select: { id: true },
  });

  const results = [];
  for (const job of jobs) {
    const out = await executeProvisioningJob(job.id);
    if (out) results.push(out);
  }
  return results;
}

