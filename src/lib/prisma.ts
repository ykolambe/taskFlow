import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";
import { resolveSecretRef } from "@/lib/secrets";

const globalForPrisma = globalThis as unknown as {
  controlPrisma: PrismaClient | undefined;
  tenantPrismaByCompany?: Map<string, PrismaClient>;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * In development, Next.js HMR can keep a cached PrismaClient from *before*
 * `npx prisma generate` added new models — delegates are then undefined.
 * Detect that and replace the singleton so new routes work without a manual restart.
 */
function isStalePrismaClient(client: PrismaClient): boolean {
  const c = client as unknown as { userReminder?: unknown; billingConfig?: unknown };
  return typeof c.userReminder === "undefined" || typeof c.billingConfig === "undefined";
}

function getControlPrisma(): PrismaClient {
  const existing = globalForPrisma.controlPrisma;
  if (process.env.NODE_ENV !== "production" && existing && isStalePrismaClient(existing)) {
    void existing.$disconnect().catch(() => {});
    globalForPrisma.controlPrisma = undefined;
  }
  if (globalForPrisma.controlPrisma) {
    return globalForPrisma.controlPrisma;
  }
  const client = createPrismaClient();
  globalForPrisma.controlPrisma = client;
  return client;
}

type TenantDbContext = { companyId: string; slug: string };
const tenantDbContext = new AsyncLocalStorage<TenantDbContext>();

export function setTenantDbContext(context: TenantDbContext): void {
  tenantDbContext.enterWith(context);
}

function getTenantDbContext(): TenantDbContext | undefined {
  return tenantDbContext.getStore();
}

function getTenantMap(): Map<string, PrismaClient> {
  if (!globalForPrisma.tenantPrismaByCompany) {
    globalForPrisma.tenantPrismaByCompany = new Map<string, PrismaClient>();
  }
  return globalForPrisma.tenantPrismaByCompany;
}

function buildTenantDatabaseUrl(infra: {
  dbHost: string | null;
  dbPort: number | null;
  dbName: string | null;
  dbUserSecretRef: string | null;
  dbPasswordSecretRef: string | null;
  dbUrlSecretRef: string | null;
}): string {
  const direct = resolveSecretRef(infra.dbUrlSecretRef);
  if (direct) return direct;
  if (!infra.dbHost || !infra.dbName) {
    throw new Error("Tenant db host/name missing");
  }
  const user = resolveSecretRef(infra.dbUserSecretRef);
  const pass = resolveSecretRef(infra.dbPasswordSecretRef);
  if (!user || !pass) {
    throw new Error("Tenant db user/password secret refs missing");
  }
  const port = infra.dbPort ?? 5432;
  const sslMode = process.env.PG_TENANT_SSLMODE;
  const sslQuery = sslMode ? `?sslmode=${encodeURIComponent(sslMode)}` : "";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${infra.dbHost}:${port}/${infra.dbName}${sslQuery}`;
}

async function getOrCreateTenantPrisma(companyId: string): Promise<PrismaClient | null> {
  const map = getTenantMap();
  const cached = map.get(companyId);
  if (cached) return cached;

  const control = getControlPrisma();
  const infra = await control.tenantInfraConfig.findUnique({
    where: { companyId },
    select: {
      dbHost: true,
      dbPort: true,
      dbName: true,
      dbUserSecretRef: true,
      dbPasswordSecretRef: true,
      dbUrlSecretRef: true,
    },
  });
  if (!infra) return null;

  try {
    const url = buildTenantDatabaseUrl(infra);
    const client = new PrismaClient({
      datasources: { db: { url } },
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
    map.set(companyId, client);
    return client;
  } catch {
    return null;
  }
}

export async function hydrateTenantPrisma(companyId: string): Promise<void> {
  await getOrCreateTenantPrisma(companyId);
}

function getActivePrismaSync(): PrismaClient {
  const context = getTenantDbContext();
  if (!context) return getControlPrisma();
  const map = getTenantMap();
  return map.get(context.companyId) ?? getControlPrisma();
}

export const controlPlanePrisma = getControlPrisma();

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const active = getActivePrismaSync();
    const value = (active as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(active);
    }
    return value;
  },
}) as PrismaClient;
