import { Client } from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { resolveSecretRef } from "@/lib/secrets";
import { controlPlanePrisma } from "@/lib/prisma";

const execFileAsync = promisify(execFile);

type TenantInfraInput = {
  companyId: string;
  dbHost: string | null;
  dbPort: number | null;
  dbName: string | null;
  dbUserSecretRef: string | null;
  dbPasswordSecretRef: string | null;
  dbUrlSecretRef: string | null;
};

export type TenantDbValidationResult = {
  secretsResolved: boolean;
  adminConnected: boolean;
  databaseExists: boolean;
  tenantConnected: boolean;
};

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

/** True if the string is a usable Prisma Postgres URL (not a secret ref name). */
function isPostgresConnectionString(s: string): boolean {
  return /^postgres(ql)?:\/\//i.test(s.trim());
}

function buildTenantDatabaseUrl(infra: TenantInfraInput): string {
  const rawDirect = resolveSecretRef(infra.dbUrlSecretRef);
  // resolveSecretRef falls back to the ref key itself when env is unset — that is not a URL.
  if (rawDirect && isPostgresConnectionString(rawDirect)) {
    return rawDirect.trim();
  }

  if (!infra.dbHost || !infra.dbName) {
    throw new Error("Tenant DB host/name is missing in infra config");
  }
  const dbUser =
    resolveSecretRef(infra.dbUserSecretRef) ??
    process.env.PG_SHARED_DEFAULT_DB_USER ??
    process.env.PG_DEFAULT_DB_USER ??
    null;
  const dbPassword =
    resolveSecretRef(infra.dbPasswordSecretRef) ??
    process.env.PG_SHARED_DEFAULT_DB_PASSWORD ??
    process.env.PG_DEFAULT_DB_PASSWORD ??
    null;
  if (!dbUser || !dbPassword) {
    throw new Error("Tenant DB credentials secret refs could not be resolved");
  }

  const port = infra.dbPort ?? 5432;
  const sslMode = process.env.PG_TENANT_SSLMODE;
  const sslQuery = sslMode ? `?sslmode=${encodeURIComponent(sslMode)}` : "";
  return `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${infra.dbHost}:${port}/${infra.dbName}${sslQuery}`;
}

async function ensureDatabaseExists(infra: TenantInfraInput): Promise<void> {
  if (!infra.dbName) throw new Error("Tenant DB name is required");
  const adminUrl = process.env.PG_ADMIN_URL;
  if (!adminUrl) {
    throw new Error("PG_ADMIN_URL is missing. Required for tenant DB bootstrap.");
  }

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1", [infra.dbName]);
    if (exists.rowCount && exists.rowCount > 0) return;

    const owner =
      resolveSecretRef(infra.dbUserSecretRef) ??
      process.env.PG_SHARED_DEFAULT_DB_USER ??
      process.env.PG_DEFAULT_DB_USER ??
      null;
    if (owner) {
      try {
        await admin.query(`CREATE DATABASE ${quoteIdentifier(infra.dbName)} OWNER ${quoteIdentifier(owner)}`);
        return;
      } catch {
        // Fallback to default owner when explicit owner fails.
      }
    }

    await admin.query(`CREATE DATABASE ${quoteIdentifier(infra.dbName)}`);
  } finally {
    await admin.end();
  }
}

async function checkDatabaseExistsWithAdmin(infra: TenantInfraInput): Promise<boolean> {
  if (!infra.dbName) throw new Error("Tenant DB name is required");
  const adminUrl = process.env.PG_ADMIN_URL;
  if (!adminUrl) {
    throw new Error("PG_ADMIN_URL is missing. Required for tenant DB validation.");
  }
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1", [infra.dbName]);
    return Boolean(exists.rowCount && exists.rowCount > 0);
  } finally {
    await admin.end();
  }
}

async function runPrismaAgainstDb(databaseUrl: string): Promise<void> {
  if (!databaseUrl || !isPostgresConnectionString(databaseUrl)) {
    throw new Error(
      "Invalid tenant DATABASE_URL for Prisma (must start with postgresql:// or postgres://). " +
        "If you use dbUrlSecretRef, set that env var to the full connection string, or rely on shared DB user/password env vars."
    );
  }
  const strategy = (process.env.PG_PROVISION_PRISMA_STRATEGY ?? "migrate").toLowerCase();
  const baseEnv = { ...process.env, DATABASE_URL: databaseUrl.trim() };
  const cwd = process.cwd();
  const schemaPath = "prisma/schema.prisma";

  async function hasMigrations(): Promise<boolean> {
    try {
      const entries = await readdir(join(cwd, "prisma/migrations"), { withFileTypes: true });
      return entries.some((entry) => entry.isDirectory() && entry.name !== ".DS_Store");
    } catch {
      return false;
    }
  }

  if (strategy === "dbpush") {
    await execFileAsync("npx", ["prisma", "db", "push", "--skip-generate", "--schema", schemaPath], {
      cwd,
      env: baseEnv,
    });
    return;
  }

  if (!(await hasMigrations())) {
    await execFileAsync("npx", ["prisma", "db", "push", "--skip-generate", "--schema", schemaPath], {
      cwd,
      env: baseEnv,
    });
    return;
  }

  try {
    await execFileAsync("npx", ["prisma", "migrate", "deploy", "--schema", schemaPath], {
      cwd,
      env: baseEnv,
    });
  } catch {
    // Dev-friendly fallback when migration files are not present yet.
    await execFileAsync("npx", ["prisma", "db", "push", "--skip-generate", "--schema", schemaPath], {
      cwd,
      env: baseEnv,
    });
  }
}

async function seedTenantDatabase(companyId: string, databaseUrl: string): Promise<void> {
  const tenant = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  try {
    const exists = await tenant.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (exists) return;

    const source = await controlPlanePrisma.company.findUnique({
      where: { id: companyId },
      include: {
        billing: true,
        roleLevels: true,
        users: true,
        taskStatuses: true,
      },
    });
    if (!source) {
      throw new Error("Company not found in control-plane DB for tenant seed");
    }

    await tenant.$transaction(async (tx) => {
      await tx.company.create({
        data: {
          id: source.id,
          name: source.name,
          slug: source.slug,
          logoUrl: source.logoUrl,
          domain: source.domain,
          isActive: source.isActive,
          modules: source.modules,
        },
      });

      if (source.billing) {
        await tx.companyBilling.create({
          data: {
            id: source.billing.id,
            companyId: source.billing.companyId,
            plan: source.billing.plan,
            pricePerSeat: source.billing.pricePerSeat,
            aiAddonEnabled: source.billing.aiAddonEnabled,
            aiPricePerSeat: source.billing.aiPricePerSeat,
            chatAddonEnabled: source.billing.chatAddonEnabled,
            chatPricePerSeat: source.billing.chatPricePerSeat,
            recurringAddonEnabled: source.billing.recurringAddonEnabled,
            recurringPricePerSeat: source.billing.recurringPricePerSeat,
            seatsLimit: source.billing.seatsLimit,
            billingEmail: source.billing.billingEmail,
            notes: source.billing.notes,
            trialEndsAt: source.billing.trialEndsAt,
            subscriptionId: source.billing.subscriptionId,
            subscriptionStatus: source.billing.subscriptionStatus,
          },
        });
      }

      if (source.roleLevels.length > 0) {
        await tx.roleLevel.createMany({
          data: source.roleLevels.map((r) => ({
            id: r.id,
            companyId: r.companyId,
            name: r.name,
            level: r.level,
            color: r.color,
            canApprove: r.canApprove,
          })),
        });
      }

      if (source.users.length > 0) {
        await tx.user.createMany({
          data: source.users.map((u) => ({
            id: u.id,
            companyId: u.companyId,
            roleLevelId: u.roleLevelId,
            parentId: u.parentId,
            email: u.email,
            username: u.username,
            passwordHash: u.passwordHash,
            firstName: u.firstName,
            lastName: u.lastName,
            avatarUrl: u.avatarUrl,
            bio: u.bio,
            phone: u.phone,
            isSuperAdmin: u.isSuperAdmin,
            aiLeaderQaEnabled: u.aiLeaderQaEnabled,
            isActive: u.isActive,
          })),
        });
      }

      if (source.taskStatuses.length > 0) {
        await tx.taskStatusConfig.createMany({
          data: source.taskStatuses.map((s) => ({
            id: s.id,
            companyId: s.companyId,
            key: s.key,
            label: s.label,
            color: s.color,
            order: s.order,
            type: s.type,
          })),
        });
      }
    });
  } finally {
    await tenant.$disconnect();
  }
}

export async function provisionTenantDatabase(infra: TenantInfraInput): Promise<{ databaseUrl: string }> {
  await ensureDatabaseExists(infra);
  const databaseUrl = buildTenantDatabaseUrl(infra);
  await runPrismaAgainstDb(databaseUrl);
  await seedTenantDatabase(infra.companyId, databaseUrl);
  return { databaseUrl };
}

export async function validateTenantDatabaseConfig(infra: TenantInfraInput): Promise<TenantDbValidationResult> {
  // Secret resolution + URL build are validated by this call.
  const databaseUrl = buildTenantDatabaseUrl(infra);

  let adminConnected = false;
  let databaseExists = false;
  if (infra.dbName) {
    databaseExists = await checkDatabaseExistsWithAdmin(infra);
    adminConnected = true;
  }

  const tenantClient = new Client({ connectionString: databaseUrl });
  await tenantClient.connect();
  try {
    await tenantClient.query("SELECT 1");
  } finally {
    await tenantClient.end();
  }

  return {
    secretsResolved: true,
    adminConnected,
    databaseExists,
    tenantConnected: true,
  };
}

