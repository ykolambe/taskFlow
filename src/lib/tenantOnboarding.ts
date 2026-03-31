import type { NextRequest } from "next/server";
import type { Company } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePassword } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { ProvisioningAction, ProvisioningStatus } from "@prisma/client";
import { enqueueProvisioningJob, processPendingProvisioningJobs } from "@/lib/tenantProvisioning";
import { resolveTenantPublicBaseUrl } from "@/lib/requestOrigin";

export type RoleLevelInput = { name: string; level: number; color: string };

export type AdminBootstrap =
  | { type: "platform_bootstrap" }
  | {
      type: "self_service";
      email: string;
      /** Plain password (hashed inside onboarding). */
      password?: string;
      /** Pre-hashed password (e.g. from pending signup after checkout). */
      passwordHash?: string;
      firstName: string;
      lastName: string;
      username?: string;
    };

export type BillingCreateInput = {
  plan?: string;
  subscriptionId?: string | null;
  subscriptionStatus?: string;
  subscriptionCurrentPeriodEnd?: Date | null;
  seatsLimit?: number | null;
  chatAddonEnabled?: boolean;
  recurringAddonEnabled?: boolean;
  aiAddonEnabled?: boolean;
  chatPricePerSeat?: number | null;
  recurringPricePerSeat?: number | null;
  aiPricePerSeat?: number | null;
};

export type CreateTenantWorkspaceParams = {
  name: string;
  slug: string;
  modules?: string[];
  roleLevels?: RoleLevelInput[];
  admin: AdminBootstrap;
  billing?: BillingCreateInput;
  /** Used for URL resolution when `req` is not available (e.g. Stripe webhook). */
  runtimeBaseUrl?: string;
  req?: NextRequest | null;
  /** Passed to `enqueueProvisioningJob` metadata (e.g. `company_create_auto` for platform). */
  provisioningJobSource?: string;
};

export type CreateTenantWorkspaceResult = {
  company: Company;
  normalizedSlug: string;
  credentials: { email: string; password: string; slug: string };
  secretRefs: {
    dbUserSecretRef: string;
    dbPasswordSecretRef: string;
    dbUrlSecretRef: string;
    aiApiKeySecretRef: string;
  };
  provisioning: { autoQueued: boolean; autoProcessed: boolean; warning: string | null };
};

function resolveUrls(req: NextRequest | null | undefined, runtimeBaseUrl: string | undefined) {
  const devFallback = "http://localhost:3000";
  if (req) {
    const defaultBackendUrl = resolveTenantPublicBaseUrl(
      req,
      process.env.SHARED_BACKEND_BASE_URL,
      process.env.NEXTAUTH_URL,
      devFallback
    );
    const defaultFrontendUrl = resolveTenantPublicBaseUrl(
      req,
      process.env.SHARED_FRONTEND_BASE_URL,
      process.env.NEXTAUTH_URL,
      devFallback
    );
    return { defaultBackendUrl, defaultFrontendUrl };
  }
  const base = (runtimeBaseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || devFallback).replace(
    /\/$/,
    ""
  );
  return { defaultBackendUrl: base, defaultFrontendUrl: base };
}

/**
 * Creates company, role levels, task statuses, bootstrap admin, infra config, billing, and enqueues provisioning.
 * Used by platform admin company creation and Stripe webhook self-service signup.
 */
export async function createTenantWorkspace(
  params: CreateTenantWorkspaceParams
): Promise<CreateTenantWorkspaceResult> {
  const { name, slug, modules, roleLevels, admin, billing, runtimeBaseUrl, req, provisioningJobSource } = params;

  const normalizedSlug = String(slug).toLowerCase().trim();
  const tenantKey = normalizedSlug.replace(/[^a-z0-9]/g, "_").toUpperCase();
  const defaultDbName = `taskflow_${normalizedSlug.replace(/-/g, "_")}`;
  const defaultDbPort = Number(process.env.PG_SHARED_DEFAULT_PORT ?? "5432");
  const defaultDbHost = process.env.PG_SHARED_DEFAULT_HOST ?? "localhost";
  const { defaultBackendUrl, defaultFrontendUrl } = resolveUrls(req ?? null, runtimeBaseUrl);
  const defaultAiProvider = process.env.SHARED_AI_PROVIDER ?? "gemini";
  const defaultAiModel = process.env.SHARED_AI_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const dbUserRef = `TENANT_${tenantKey}_DB_USER`;
  const dbPasswordRef = `TENANT_${tenantKey}_DB_PASSWORD`;
  const dbUrlRef = `TENANT_${tenantKey}_DATABASE_URL`;
  const aiKeyRef = `TENANT_${tenantKey}_GEMINI_API_KEY`;

  let bootstrapEmail: string;
  let bootstrapUsername: string;
  let firstName: string;
  let lastName: string;

  let passwordHash: string;
  let credentialPasswordPlain: string;

  if (admin.type === "platform_bootstrap") {
    credentialPasswordPlain = generatePassword(12);
    bootstrapEmail = `admin@${normalizedSlug}.taskflow.local`;
    bootstrapUsername = "admin";
    firstName = "Super";
    lastName = "Admin";
    passwordHash = await bcrypt.hash(credentialPasswordPlain, 12);
  } else {
    bootstrapEmail = admin.email.toLowerCase().trim();
    bootstrapUsername =
      admin.username?.trim() ||
      `${admin.firstName.toLowerCase().replace(/\s/g, "")}${Math.floor(Math.random() * 1000)}`;
    firstName = admin.firstName;
    lastName = admin.lastName;
    if (admin.passwordHash) {
      passwordHash = admin.passwordHash;
      credentialPasswordPlain = "";
    } else if (admin.password) {
      passwordHash = await bcrypt.hash(admin.password, 12);
      credentialPasswordPlain = admin.password;
    } else {
      throw new Error("self_service admin requires password or passwordHash");
    }
  }

  const boot = billing || {};

  const txResult = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: { name, slug: normalizedSlug, modules: modules || ["tasks", "team", "org", "approvals"] },
    });

    const createdLevels = await Promise.all(
      (roleLevels || [{ name: "Admin", level: 1, color: "#6366f1" }]).map((rl) =>
        tx.roleLevel.create({
          data: {
            companyId: created.id,
            name: rl.name,
            level: rl.level,
            color: rl.color || "#6366f1",
          },
        })
      )
    );

    const DEFAULT_STATUSES = [
      { key: "TODO", label: "To Do", color: "#64748b", order: 1, type: "OPEN" as const },
      { key: "IN_PROGRESS", label: "In Progress", color: "#3b82f6", order: 2, type: "ACTIVE" as const },
      { key: "READY_FOR_REVIEW", label: "Ready for Review", color: "#f59e0b", order: 3, type: "REVIEW" as const },
      { key: "COMPLETED", label: "Completed", color: "#10b981", order: 4, type: "DONE" as const },
    ];
    await Promise.all(
      DEFAULT_STATUSES.map((s) => tx.taskStatusConfig.create({ data: { companyId: created.id, ...s } }))
    );

    const topLevel = createdLevels.sort((a, b) => a.level - b.level)[0];

    await tx.user.create({
      data: {
        companyId: created.id,
        roleLevelId: topLevel?.id ?? null,
        email: bootstrapEmail,
        username: bootstrapUsername,
        passwordHash,
        firstName,
        lastName,
        isSuperAdmin: true,
        isTenantBootstrapAccount: true,
        chatAddonAccess: boot.chatAddonEnabled ?? false,
        recurringAddonAccess: boot.recurringAddonEnabled ?? false,
        aiAddonAccess: boot.aiAddonEnabled ?? false,
      },
    });

    await tx.tenantInfraConfig.upsert({
      where: { companyId: created.id },
      update: {},
      create: {
        companyId: created.id,
        deploymentMode: "SHARED",
        provisioningStatus: ProvisioningStatus.PENDING,
        backendBaseUrl: defaultBackendUrl,
        frontendBaseUrl: defaultFrontendUrl,
        dbHost: defaultDbHost,
        dbPort: defaultDbPort,
        dbName: defaultDbName,
        dbUserSecretRef: dbUserRef,
        dbPasswordSecretRef: dbPasswordRef,
        dbUrlSecretRef: dbUrlRef,
        aiProvider: defaultAiProvider,
        aiModel: defaultAiModel,
        aiApiKeySecretRef: aiKeyRef,
      },
    });

    const b = boot;
    await tx.companyBilling.upsert({
      where: { companyId: created.id },
      update: {},
      create: {
        companyId: created.id,
        plan: b.plan ?? "FREE",
        ...(b.subscriptionId != null ? { subscriptionId: b.subscriptionId } : {}),
        ...(b.subscriptionStatus != null ? { subscriptionStatus: b.subscriptionStatus } : {}),
        ...(b.subscriptionCurrentPeriodEnd != null ? { subscriptionCurrentPeriodEnd: b.subscriptionCurrentPeriodEnd } : {}),
        ...(b.seatsLimit != null ? { seatsLimit: b.seatsLimit } : {}),
        chatAddonEnabled: b.chatAddonEnabled ?? false,
        recurringAddonEnabled: b.recurringAddonEnabled ?? false,
        aiAddonEnabled: b.aiAddonEnabled ?? false,
        ...(b.chatPricePerSeat != null ? { chatPricePerSeat: b.chatPricePerSeat } : {}),
        ...(b.recurringPricePerSeat != null ? { recurringPricePerSeat: b.recurringPricePerSeat } : {}),
        ...(b.aiPricePerSeat != null ? { aiPricePerSeat: b.aiPricePerSeat } : {}),
      },
    });

    return created;
  });

  const idempotencyKey = `auto-provision-${txResult.id}`;
  await enqueueProvisioningJob(
    txResult.id,
    ProvisioningAction.PROVISION,
    { source: provisioningJobSource ?? "tenant_onboarding", forceDbBootstrap: true },
    idempotencyKey
  );

  let autoProcessed = false;
  let provisioningWarning: string | null = null;
  if (!process.env.PG_ADMIN_URL) {
    provisioningWarning =
      "PG_ADMIN_URL is missing. Company was created and provisioning queued, but DB bootstrap was not auto-processed yet.";
  } else {
    try {
      await processPendingProvisioningJobs(1);
      autoProcessed = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Auto provisioning failed";
      provisioningWarning = `Company created, but auto provisioning failed: ${msg}`;
    }
  }

  return {
    company: txResult,
    normalizedSlug,
    credentials: {
      email: bootstrapEmail,
      password: credentialPasswordPlain,
      slug: normalizedSlug,
    },
    secretRefs: {
      dbUserSecretRef: dbUserRef,
      dbPasswordSecretRef: dbPasswordRef,
      dbUrlSecretRef: dbUrlRef,
      aiApiKeySecretRef: aiKeyRef,
    },
    provisioning: { autoQueued: true, autoProcessed, warning: provisioningWarning },
  };
}
