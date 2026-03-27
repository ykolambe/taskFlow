import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isExecutiveDashboardUser } from "@/lib/utils";
import TenantLayout from "@/components/layout/TenantLayout";
import TenantDashboard from "@/components/tenant/TenantDashboard";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company || !company.isActive) notFound();

  // Get visible subordinate IDs (users below in hierarchy)
  const allUsers = await prisma.user.findMany({
    where: { companyId: company.id, isActive: true },
    include: { roleLevel: true },
  });

  // Get IDs of users the current user can see (themselves + below in hierarchy)
  function getSubtreeIds(userId: string): string[] {
    const directChildren = allUsers.filter((u) => u.parentId === userId).map((u) => u.id);
    return [userId, ...directChildren.flatMap((id) => getSubtreeIds(id))];
  }

  const visibleIds = getSubtreeIds(user.userId);
  const teamAssigneeIds = visibleIds.filter((id) => id !== user.userId);

  const openTaskBase = {
    companyId: company.id,
    isArchived: false,
    status: { not: "COMPLETED" as const },
  };

  const RECENT_TASKS_PAGE = 5;
  const REMINDER_PAGE = 8;

  // Count approval requests where it is the current user's turn (or all pending for super admin)
  const countMyPendingApprovals = async (): Promise<number> => {
    if (user!.isSuperAdmin) {
      return prisma.approvalRequest.count({ where: { companyId: company!.id, status: "PENDING" } });
    }
    const allPending = await prisma.approvalRequest.findMany({
      where: { companyId: company!.id, status: "PENDING" },
      select: { approverChain: true, approvals: { select: { approverId: true, status: true } } },
    });
    return allPending.filter((req) => {
      const chain = req.approverChain as string[];
      const approvedIds = new Set(req.approvals.filter((a) => a.status === "APPROVED").map((a) => a.approverId));
      const next = chain.find((uid) => !approvedIds.has(uid));
      return next === user!.userId;
    }).length;
  };

  // Tasks stats + chart aggregates + totals for pagination hints
  const [
    myTasks,
    teamTasks,
    pendingApprovals,
    overdueTasks,
    myPriorityBreakdown,
    teamPriorityBreakdown,
    myTasksTotalCount,
  ] = await Promise.all([
    prisma.task.count({
      where: { companyId: company.id, assigneeId: user.userId, isArchived: false, status: { not: "COMPLETED" } },
    }),
    prisma.task.count({
      where: {
        companyId: company.id,
        assigneeId: { in: teamAssigneeIds },
        isArchived: false,
        status: { not: "COMPLETED" },
      },
    }),
    countMyPendingApprovals(),
    prisma.task.count({
      where: {
        companyId: company.id,
        assigneeId: { in: visibleIds },
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.task.groupBy({
      by: ["priority"],
      where: { ...openTaskBase, assigneeId: user.userId },
      _count: { _all: true },
    }),
    teamAssigneeIds.length
      ? prisma.task.groupBy({
          by: ["priority"],
          where: { ...openTaskBase, assigneeId: { in: teamAssigneeIds } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { priority: string; _count: { _all: number } }[]),
    prisma.task.count({
      where: { companyId: company.id, assigneeId: user.userId, isArchived: false },
    }),
  ]);

  // Recent my tasks
  const recentTasks = await prisma.task.findMany({
    where: {
      companyId: company.id,
      assigneeId: user.userId,
      isArchived: false,
    },
    orderBy: { updatedAt: "desc" },
    take: RECENT_TASKS_PAGE,
    include: {
      creator: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true } },
      assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true } },
    },
  });

  const [reminderRows, reminderOpenCount, highPriorityOpen] = await Promise.all([
    prisma.userReminder.findMany({
      where: { companyId: company.id, userId: user.userId, isDone: false },
      orderBy: { remindAt: "asc" },
      take: REMINDER_PAGE,
      skip: 0,
    }),
    prisma.userReminder.count({
      where: { companyId: company.id, userId: user.userId, isDone: false },
    }),
    prisma.task.count({
      where: {
        companyId: company.id,
        assigneeId: { in: visibleIds },
        isArchived: false,
        priority: { in: ["HIGH", "URGENT"] },
      },
    }),
  ]);

  const reminders = reminderRows.map((r) => ({
    id: r.id,
    title: r.title,
    note: r.note,
    remindAt: r.remindAt.toISOString(),
    isDone: r.isDone,
  }));

  const directReports = allUsers.filter((u) => u.parentId === user.userId).length;
  const remindersHasMore = reminderOpenCount > reminderRows.length;
  const recentTasksHasMore = myTasksTotalCount > RECENT_TASKS_PAGE;

  const executiveInsights = isExecutiveDashboardUser(user)
    ? {
        directReports,
        teamSize: visibleIds.length,
        highPriorityOpen,
      }
    : null;

  // Team tasks needing review
  const reviewTasks = await prisma.task.findMany({
    where: {
      companyId: company.id,
      creatorId: user.userId,
      status: "READY_FOR_REVIEW",
      isArchived: false,
    },
    take: 5,
    include: {
      creator: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true } },
      assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true } },
    },
  });

  return (
    <TenantLayout user={user} companyName={company.name} companyLogoUrl={company.logoUrl} slug={slug} modules={company.modules} pendingApprovals={pendingApprovals}>
      <TenantDashboard
        user={user}
        stats={{ myTasks, teamTasks, pendingApprovals, overdueTasks }}
        recentTasks={recentTasks as any}
        recentTasksPageSize={RECENT_TASKS_PAGE}
        recentTasksHasMore={recentTasksHasMore}
        chartData={{
          myByPriority: myPriorityBreakdown.map((r) => ({ priority: r.priority, count: r._count._all })),
          teamByPriority: teamPriorityBreakdown.map((r) => ({ priority: r.priority, count: r._count._all })),
        }}
        reviewTasks={reviewTasks as any}
        slug={slug}
        reminders={reminders}
        remindersHasMore={remindersHasMore}
        executiveInsights={executiveInsights}
      />
    </TenantLayout>
  );
}
