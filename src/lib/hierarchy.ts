import { prisma } from "@/lib/prisma";
import { getPrimaryManagerId, getAncestorManagerIds, linksFromDb } from "@/lib/reportingLinks";

/** Walk up primary-manager chain: [directParent, ..., root] — skips tenant bootstrap accounts. */
export async function getAncestorUserIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  if (!user) return [];

  const links = await prisma.userReportingLink.findMany({
    where: { companyId: user.companyId },
    select: { subordinateId: true, managerId: true, sortOrder: true },
  });
  const lr = linksFromDb(links);

  const chain: string[] = [];
  let cursor = userId;
  for (let i = 0; i < 200; i++) {
    const parentId = getPrimaryManagerId(lr, cursor);
    if (!parentId) break;
    const parent = await prisma.user.findUnique({
      where: { id: parentId },
      select: { isTenantBootstrapAccount: true },
    });
    if (!parent) break;
    if (!parent.isTenantBootstrapAccount) {
      chain.push(parentId);
    }
    cursor = parentId;
  }
  return chain;
}

/** All managers above userId (any reporting line), excluding bootstrap — for visibility / union paths. */
export async function getAllAncestorManagerIds(userId: string, companyId: string): Promise<string[]> {
  const links = await prisma.userReportingLink.findMany({
    where: { companyId },
    select: { subordinateId: true, managerId: true, sortOrder: true },
  });
  const raw = getAncestorManagerIds(linksFromDb(links), userId);
  if (raw.length === 0) return [];
  const bootstrapRows = await prisma.user.findMany({
    where: { id: { in: raw }, isTenantBootstrapAccount: true },
    select: { id: true },
  });
  const boot = new Set(bootstrapRows.map((r) => r.id));
  return raw.filter((id) => !boot.has(id));
}
