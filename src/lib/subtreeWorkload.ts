import type { Priority } from "@prisma/client";
import type { ReportingLinkRow } from "@/lib/reportingLinks";
import { getPrimaryDirectSubordinateIds, getPrimarySubtreeIds } from "@/lib/reportingLinks";

/** @deprecated Use ReportingLinkRow[] with getReachableSubordinateIds */
export interface SubtreeUserRef {
  id: string;
  parentId: string | null;
}

/** All user IDs in the primary org subtree rooted at rootId (includes root). */
export function getSubtreeIds(links: ReportingLinkRow[], rootId: string): string[] {
  return getPrimarySubtreeIds(links, rootId);
}

/** Direct reports on the primary tree (one level below managerId). */
export function getDirectReportIds(links: ReportingLinkRow[], managerId: string): string[] {
  return getPrimaryDirectSubordinateIds(links, managerId);
}

export interface WorkloadTaskPick {
  assigneeId: string;
  status: string;
  dueDate: Date | null;
  priority: Priority;
}

export interface TeamWorkloadRow {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roleLevel: { name: string; color: string; level: number };
  active: number;
  overdue: number;
  urgent: number;
  loadShare: number;
  isBottleneck: boolean;
  teamAvgActive: number;
}

function isTaskDone(status: string, doneKeys: Set<string>): boolean {
  return doneKeys.has(status) || status === "COMPLETED";
}

export function buildTeamWorkloadRows(
  subordinateIds: string[],
  tasks: WorkloadTaskPick[],
  doneKeys: Set<string>,
  users: Array<{
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    roleLevel: { name: string; color: string; level: number } | null;
  }>,
  now: Date
): TeamWorkloadRow[] {
  const counts = new Map<string, { active: number; overdue: number; urgent: number }>();
  for (const id of subordinateIds) {
    counts.set(id, { active: 0, overdue: 0, urgent: 0 });
  }

  for (const t of tasks) {
    if (isTaskDone(t.status, doneKeys)) continue;
    const c = counts.get(t.assigneeId);
    if (!c) continue;
    c.active += 1;
    if (t.priority === "URGENT" || t.priority === "HIGH") c.urgent += 1;
    if (t.dueDate && t.dueDate < now) c.overdue += 1;
  }

  const rows: TeamWorkloadRow[] = [];
  for (const id of subordinateIds) {
    const u = users.find((x) => x.id === id);
    if (!u) continue;
    const c = counts.get(id)!;
    const rl = u.roleLevel ?? { name: "—", color: "#64748b", level: 999 };
    rows.push({
      userId: id,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarUrl: u.avatarUrl,
      roleLevel: rl,
      active: c.active,
      overdue: c.overdue,
      urgent: c.urgent,
      loadShare: 0,
      isBottleneck: false,
      teamAvgActive: 0,
    });
  }

  rows.sort((a, b) => b.active - a.active);

  const n = rows.length;
  const sumActive = rows.reduce((s, r) => s + r.active, 0);
  const teamAvgActive = n > 0 ? sumActive / n : 0;
  const maxActive = rows.reduce((m, r) => Math.max(m, r.active), 0);

  for (const r of rows) {
    r.teamAvgActive = Math.round(teamAvgActive * 10) / 10;
    r.loadShare = maxActive > 0 ? r.active / maxActive : 0;
    r.isBottleneck =
      n >= 2 &&
      teamAvgActive > 0 &&
      r.active >= Math.max(teamAvgActive * 1.5, 4) &&
      r.active > teamAvgActive;
  }

  return rows;
}
