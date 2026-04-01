/**
 * In-memory helpers for user_reporting_links (many managers per subordinate).
 * sortOrder: lower = more primary (0 = primary for org chart + single-chain approvals).
 */

import type { PrismaClient } from "@prisma/client";

export type ReportingLinkRow = { subordinateId: string; managerId: string; sortOrder: number };

export function linksFromDb(
  rows: Array<{ subordinateId: string; managerId: string; sortOrder: number }>
): ReportingLinkRow[] {
  return rows.map((r) => ({
    subordinateId: r.subordinateId,
    managerId: r.managerId,
    sortOrder: r.sortOrder,
  }));
}

export function getPrimaryManagerId(links: ReportingLinkRow[], subordinateId: string): string | null {
  const mine = links.filter((l) => l.subordinateId === subordinateId);
  if (mine.length === 0) return null;
  mine.sort((a, b) => a.sortOrder - b.sortOrder || a.managerId.localeCompare(b.managerId));
  return mine[0].managerId;
}

/**
 * Parent for org chart edges: first reporting line whose manager is in the drawable set (sortOrder order).
 * Skips bootstrap / hidden accounts that are not in `drawableUserIds`, so a person can report to Tejas
 * even when a tenant bootstrap user is listed as a secondary manager.
 */
export function getOrgChartParentId(
  links: ReportingLinkRow[],
  subordinateId: string,
  drawableUserIds: Set<string>
): string | null {
  const mine = links
    .filter((l) => l.subordinateId === subordinateId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.managerId.localeCompare(b.managerId));
  for (const l of mine) {
    if (drawableUserIds.has(l.managerId)) return l.managerId;
  }
  return null;
}

/** Direct reports under this manager on the primary org tree (primary manager of subordinate === managerId). */
export function getPrimaryDirectSubordinateIds(links: ReportingLinkRow[], managerId: string): string[] {
  const subs = new Set(links.filter((l) => l.managerId === managerId).map((l) => l.subordinateId));
  return [...subs].filter((sid) => getPrimaryManagerId(links, sid) === managerId);
}

/** All user ids in the primary subtree rooted at rootId (includes root). */
export function getPrimarySubtreeIds(links: ReportingLinkRow[], rootId: string): string[] {
  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const m = queue.shift()!;
    for (const sub of getPrimaryDirectSubordinateIds(links, m)) {
      if (!seen.has(sub)) {
        seen.add(sub);
        queue.push(sub);
      }
    }
  }
  return [...seen];
}

export function getDirectSubordinateIds(links: ReportingLinkRow[], managerId: string): string[] {
  return links.filter((l) => l.managerId === managerId).map((l) => l.subordinateId);
}

/** All user ids reachable by following manager → subordinate edges downward from rootManagerId (includes root). */
export function getReachableSubordinateIds(links: ReportingLinkRow[], rootManagerId: string): Set<string> {
  const byManager = new Map<string, string[]>();
  for (const l of links) {
    if (!byManager.has(l.managerId)) byManager.set(l.managerId, []);
    byManager.get(l.managerId)!.push(l.subordinateId);
  }
  const seen = new Set<string>([rootManagerId]);
  const queue = [rootManagerId];
  while (queue.length) {
    const m = queue.shift()!;
    for (const sub of byManager.get(m) ?? []) {
      if (!seen.has(sub)) {
        seen.add(sub);
        queue.push(sub);
      }
    }
  }
  return seen;
}

/** Managers above this user (walking up all reporting lines). */
export function getAncestorManagerIds(links: ReportingLinkRow[], startSubordinateId: string): string[] {
  const bySub = new Map<string, ReportingLinkRow[]>();
  for (const l of links) {
    if (!bySub.has(l.subordinateId)) bySub.set(l.subordinateId, []);
    bySub.get(l.subordinateId)!.push(l);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  const queue: string[] = [];
  for (const l of bySub.get(startSubordinateId) ?? []) {
    queue.push(l.managerId);
  }
  while (queue.length) {
    const m = queue.shift()!;
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
    for (const up of bySub.get(m) ?? []) {
      if (!seen.has(up.managerId)) queue.push(up.managerId);
    }
  }
  return out;
}

export function isTargetUnderManager(links: ReportingLinkRow[], managerId: string, targetId: string): boolean {
  if (targetId === managerId) return true;
  return getReachableSubordinateIds(links, managerId).has(targetId);
}

export async function fetchReportingLinksForCompany(
  db: PrismaClient,
  companyId: string
): Promise<ReportingLinkRow[]> {
  const rows = await db.userReportingLink.findMany({
    where: { companyId },
    select: { subordinateId: true, managerId: true, sortOrder: true },
  });
  return linksFromDb(rows);
}
