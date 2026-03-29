import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser, signToken } from "@/lib/auth";
import { generatePassword } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { ProvisioningAction, ProvisioningStatus } from "@prisma/client";
import { enqueueProvisioningJob, processPendingProvisioningJobs } from "@/lib/tenantProvisioning";
import { resolveTenantPublicBaseUrl } from "@/lib/requestOrigin";

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

    const existing = await prisma.company.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "This slug is already taken" }, { status: 409 });
    }

    const normalizedSlug = String(slug).toLowerCase().trim();
    const tenantKey = normalizedSlug.replace(/[^a-z0-9]/g, "_").toUpperCase();
    const defaultDbName = `taskflow_${normalizedSlug.replace(/-/g, "_")}`;
    const defaultDbPort = Number(process.env.PG_SHARED_DEFAULT_PORT ?? "5432");
    const defaultDbHost = process.env.PG_SHARED_DEFAULT_HOST ?? "localhost";
    const defaultBackendUrl = resolveTenantPublicBaseUrl(
      req,
      process.env.SHARED_BACKEND_BASE_URL,
      process.env.NEXTAUTH_URL,
      "http://localhost:3000"
    );
    const defaultFrontendUrl = resolveTenantPublicBaseUrl(
      req,
      process.env.SHARED_FRONTEND_BASE_URL,
      process.env.NEXTAUTH_URL,
      "http://localhost:3000"
    );
    const defaultAiProvider = process.env.SHARED_AI_PROVIDER ?? "gemini";
    const defaultAiModel = process.env.SHARED_AI_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const dbUserRef = `TENANT_${tenantKey}_DB_USER`;
    const dbPasswordRef = `TENANT_${tenantKey}_DB_PASSWORD`;
    const dbUrlRef = `TENANT_${tenantKey}_DATABASE_URL`;
    const aiKeyRef = `TENANT_${tenantKey}_GEMINI_API_KEY`;

    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: { name, slug: normalizedSlug, modules: modules || ["tasks", "team", "org", "approvals"] },
      });

      const createdLevels = await Promise.all(
        (roleLevels || [{ name: "Admin", level: 1, color: "#6366f1" }]).map((rl: { name: string; level: number; color: string }) =>
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

      // Create default task status configs
      const DEFAULT_STATUSES = [
        { key: "TODO",             label: "To Do",            color: "#64748b", order: 1, type: "OPEN"   as const },
        { key: "IN_PROGRESS",      label: "In Progress",      color: "#3b82f6", order: 2, type: "ACTIVE" as const },
        { key: "READY_FOR_REVIEW", label: "Ready for Review", color: "#f59e0b", order: 3, type: "REVIEW" as const },
        { key: "COMPLETED",        label: "Completed",        color: "#10b981", order: 4, type: "DONE"   as const },
      ];
      await Promise.all(
        DEFAULT_STATUSES.map((s) =>
          tx.taskStatusConfig.create({ data: { companyId: created.id, ...s } })
        )
      );

      // Create super admin user with top role level by default.
      const password = generatePassword(12);
      const email = `admin@${normalizedSlug}.taskflow.local`;
      const topLevel = createdLevels.sort((a, b) => a.level - b.level)[0];

      await tx.user.create({
        data: {
          companyId: created.id,
          roleLevelId: topLevel?.id ?? null,
          email,
          username: "admin",
          passwordHash: await bcrypt.hash(password, 12),
          firstName: "Super",
          lastName: "Admin",
          isSuperAdmin: true,
          isTenantBootstrapAccount: true,
        },
      });

      // Shared-mode defaults for fully automatic tenant bootstrap.
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

      await tx.companyBilling.upsert({
        where: { companyId: created.id },
        update: {},
        create: {
          companyId: created.id,
          plan: "FREE",
        },
      });

      return { created, email, password };
    });

    const idempotencyKey = `auto-provision-${company.created.id}`;
    await enqueueProvisioningJob(
      company.created.id,
      ProvisioningAction.PROVISION,
      { source: "company_create_auto", forceDbBootstrap: true },
      idempotencyKey
    );

    let autoProcessed = false;
    let provisioningWarning: string | null = null;
    if (!process.env.PG_ADMIN_URL) {
      provisioningWarning =
        "PG_ADMIN_URL is missing. Company was created and provisioning queued, but DB bootstrap was not auto-processed yet.";
    } else {
      try {
        // Try to process immediately for true "one-step" onboarding in shared mode.
        await processPendingProvisioningJobs(1);
        autoProcessed = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Auto provisioning failed";
        provisioningWarning = `Company created, but auto provisioning failed: ${msg}`;
      }
    }

    return NextResponse.json({
      success: true,
      company: company.created,
      credentials: { email: company.email, password: company.password, slug: normalizedSlug },
      provisioning: { autoQueued: true, autoProcessed, warning: provisioningWarning },
      secretRefs: {
        dbUserSecretRef: dbUserRef,
        dbPasswordSecretRef: dbPasswordRef,
        dbUrlSecretRef: dbUrlRef,
        aiApiKeySecretRef: aiKeyRef,
      },
    });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
