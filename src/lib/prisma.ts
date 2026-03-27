import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
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

function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (process.env.NODE_ENV !== "production" && existing && isStalePrismaClient(existing)) {
    void existing.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  return globalForPrisma.prisma ?? createPrismaClient();
}

export const prisma = getPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
