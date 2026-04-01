import type { PrismaClient } from "@prisma/client";
import type { ReportingLinkRow } from "@/lib/reportingLinks";
import { getPrimaryManagerId } from "@/lib/reportingLinks";

export type LeaderQaOrgContext = {
  scopeNote: string;
  teamMembers: Array<{ name: string; role: string }>;
  primaryReportingEdges: Array<{ manager: string; report: string }>;
  openTasksSample: Array<{
    title: string;
    assignee: string;
    priority: string;
    status: string;
    due: string | null;
  }>;
  pendingTaskRequests: Array<{ title: string; requester: string; approver: string }>;
  ideasRecent: Array<{ title: string; status: string; author: string }>;
  ideasByStatus: Record<string, number>;
  activeRecurring: Array<{ title: string; assignee: string; frequency: string; nextDue: string | null }>;
  calendarUpcoming: Array<{ title: string; start: string; kind: string; notes: string | null }>;
  myReminders: { overdueCount: number; dueNext7DaysCount: number; upcomingTitles: string[] };
  counts: {
    pendingTaskRequests: number;
    activeRecurringSeries: number;
    ideasNotConverted: number;
    calendarEntriesNext30Days: number;
  };
};

const CAP = {
  team: 80,
  edges: 60,
  tasks: 28,
  taskReq: 18,
  ideas: 18,
  recurring: 18,
  calendar: 22,
  reminderTitles: 8,
} as const;

function isoDay(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchLeaderQaOrgContext(
  db: PrismaClient,
  opts: {
    companyId: string;
    visibleUserIds: string[];
    viewerUserId: string;
    users: Array<{ id: string; firstName: string; lastName: string; roleLevel: { name: string } | null }>;
    reportingLinks: ReportingLinkRow[];
    openTasks: Array<{
      title: string;
      status: string;
      priority: string;
      dueDate: Date | null;
      assignee: { firstName: string; lastName: string };
    }>;
    now: Date;
  }
): Promise<LeaderQaOrgContext> {
  const { companyId, visibleUserIds, viewerUserId, users, reportingLinks, openTasks, now } = opts;
  const visibleSet = new Set(visibleUserIds);
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const nameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

  const primaryReportingEdges: LeaderQaOrgContext["primaryReportingEdges"] = [];
  for (const uid of visibleUserIds) {
    const mgr = getPrimaryManagerId(reportingLinks, uid);
    if (!mgr || !visibleSet.has(mgr)) continue;
    const mName = nameById.get(mgr);
    const rName = nameById.get(uid);
    if (!mName || !rName) continue;
    primaryReportingEdges.push({ manager: mName, report: rName });
    if (primaryReportingEdges.length >= CAP.edges) break;
  }

  const sortedOpen = [...openTasks].sort((a, b) => {
    const ad = a.dueDate?.getTime() ?? Infinity;
    const bd = b.dueDate?.getTime() ?? Infinity;
    return ad - bd;
  });
  const openTasksSample = sortedOpen.slice(0, CAP.tasks).map((t) => ({
    title: t.title.slice(0, 200),
    assignee: `${t.assignee.firstName} ${t.assignee.lastName}`.trim(),
    priority: t.priority,
    status: t.status,
    due: isoDay(t.dueDate),
  }));

  const teamMembers = users
    .filter((u) => visibleSet.has(u.id))
    .slice(0, CAP.team)
    .map((u) => ({
      name: `${u.firstName} ${u.lastName}`.trim(),
      role: u.roleLevel?.name ?? "—",
    }));

  const orgCal = await db.calendarCollection.findFirst({
    where: { companyId, type: "ORG", isArchived: false },
    select: { id: true },
  });

  const calendarWhere = {
    companyId,
    isDone: false,
    startAt: { gte: now, lte: in30 },
    OR: [
      ...(orgCal?.id ? [{ calendarId: orgCal.id }] : []),
      { creatorId: { in: visibleUserIds } },
    ],
  };

  const [
    taskReqRows,
    taskReqCount,
    ideaRows,
    ideaGroup,
    recurringRows,
    recurringCount,
    calRows,
    calCount,
    reminderOverdue,
    reminderNext7,
    reminderTitles,
  ] = await Promise.all([
    db.taskRequest.findMany({
      where: {
        companyId,
        status: "PENDING",
        OR: [{ requesterId: { in: visibleUserIds } }, { approverId: { in: visibleUserIds } }],
      },
      orderBy: { createdAt: "desc" },
      take: CAP.taskReq,
      select: {
        title: true,
        requester: { select: { firstName: true, lastName: true } },
        approver: { select: { firstName: true, lastName: true } },
      },
    }),
    db.taskRequest.count({
      where: {
        companyId,
        status: "PENDING",
        OR: [{ requesterId: { in: visibleUserIds } }, { approverId: { in: visibleUserIds } }],
      },
    }),
    db.idea.findMany({
      where: { companyId, userId: { in: visibleUserIds } },
      orderBy: { updatedAt: "desc" },
      take: CAP.ideas,
      select: {
        title: true,
        status: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    db.idea.groupBy({
      by: ["status"],
      where: { companyId, userId: { in: visibleUserIds } },
      _count: { _all: true },
    }),
    db.recurringTask.findMany({
      where: { companyId, assigneeId: { in: visibleUserIds }, isActive: true },
      orderBy: { updatedAt: "desc" },
      take: CAP.recurring,
      select: {
        title: true,
        frequency: true,
        nextDue: true,
        assignee: { select: { firstName: true, lastName: true } },
      },
    }),
    db.recurringTask.count({
      where: { companyId, assigneeId: { in: visibleUserIds }, isActive: true },
    }),
    db.calendarEntry.findMany({
      where: calendarWhere,
      orderBy: { startAt: "asc" },
      take: CAP.calendar,
      select: { title: true, startAt: true, kind: true, notes: true },
    }),
    db.calendarEntry.count({
      where: calendarWhere,
    }),
    db.userReminder.count({
      where: { companyId, userId: viewerUserId, isDone: false, remindAt: { lt: now } },
    }),
    db.userReminder.count({
      where: { companyId, userId: viewerUserId, isDone: false, remindAt: { gte: now, lte: in7 } },
    }),
    db.userReminder.findMany({
      where: {
        companyId,
        userId: viewerUserId,
        isDone: false,
        remindAt: { gte: now },
      },
      orderBy: { remindAt: "asc" },
      take: CAP.reminderTitles,
      select: { title: true },
    }),
  ]);

  const ideasByStatus: Record<string, number> = {};
  for (const g of ideaGroup) {
    ideasByStatus[g.status] = g._count._all;
  }

  const ideasNotConverted = (ideasByStatus["IDEA"] ?? 0) + (ideasByStatus["THINKING"] ?? 0);

  const pendingTaskRequests = taskReqRows.map((r) => ({
    title: r.title.slice(0, 200),
    requester: `${r.requester.firstName} ${r.requester.lastName}`.trim(),
    approver: `${r.approver.firstName} ${r.approver.lastName}`.trim(),
  }));

  const ideasRecent = ideaRows.map((i) => ({
    title: i.title.slice(0, 200),
    status: i.status,
    author: `${i.user.firstName} ${i.user.lastName}`.trim(),
  }));

  const activeRecurring = recurringRows.map((r) => ({
    title: r.title.slice(0, 200),
    assignee: `${r.assignee.firstName} ${r.assignee.lastName}`.trim(),
    frequency: r.frequency,
    nextDue: r.nextDue ? r.nextDue.toISOString() : null,
  }));

  const calendarUpcoming = calRows.map((c) => ({
    title: c.title.slice(0, 200),
    start: c.startAt.toISOString(),
    kind: c.kind,
    notes: c.notes ? c.notes.slice(0, 240) : null,
  }));

  return {
    scopeNote:
      "Data is limited to your visible org subtree (primary reporting tree), plus your personal reminders. Use only this payload; do not invent records.",
    teamMembers,
    primaryReportingEdges,
    openTasksSample,
    pendingTaskRequests,
    ideasRecent,
    ideasByStatus,
    activeRecurring,
    calendarUpcoming,
    myReminders: {
      overdueCount: reminderOverdue,
      dueNext7DaysCount: reminderNext7,
      upcomingTitles: reminderTitles.map((x) => x.title.slice(0, 120)),
    },
    counts: {
      pendingTaskRequests: taskReqCount,
      activeRecurringSeries: recurringCount,
      ideasNotConverted,
      calendarEntriesNext30Days: calCount,
    },
  };
}

/** Derive open tasks with assignee payload for aggregation + org context. */
export function filterOpenTasksForLeaderQa<
  T extends {
    status: string;
    dueDate: Date | null;
    createdAt: Date;
    completedAt: Date | null;
    title: string;
    assignee: { firstName: string; lastName: string };
  },
>(tasks: T[], doneKeys: Set<string>): T[] {
  return tasks.filter((t) => !doneKeys.has(t.status) && t.status !== "COMPLETED");
}
