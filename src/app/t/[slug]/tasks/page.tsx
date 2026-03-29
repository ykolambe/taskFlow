import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import TenantLayout from "@/components/layout/TenantLayout";
import TasksBoard from "@/components/tenant/TasksBoard";
import { countPendingApprovalsForUser } from "@/lib/approvalRequestCounts";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams:
    | Promise<{ status?: string; task?: string; new?: string; request?: string }>
    | { status?: string; task?: string; new?: string; request?: string };
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company || !company.isActive) notFound();

  const taskStatuses = await prisma.taskStatusConfig.findMany({
    where: { companyId: company.id },
    orderBy: { order: "asc" },
  });

  // Get all users the current user can see
  const allUsers = await prisma.user.findMany({
    where: {
      companyId: company.id,
      isActive: true,
      OR: [{ id: user.userId }, { isTenantBootstrapAccount: false }],
    },
    include: { roleLevel: true },
    orderBy: [{ roleLevel: { level: "asc" } }, { firstName: "asc" }],
  });

  function getSubtreeIds(userId: string): string[] {
    const children = allUsers.filter((u) => u.parentId === userId).map((u) => u.id);
    return [userId, ...children.flatMap((id) => getSubtreeIds(id))];
  }

  const visibleUserIds = getSubtreeIds(user.userId);

  const tasks = await prisma.task.findMany({
    where: {
      companyId: company.id,
      assigneeId: { in: visibleUserIds },
      isArchived: false,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      creator: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true },
      },
      assignee: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true },
      },
      attachments: true,
    },
  });

  // Archived tasks: only visible to users who have people below them (level < max).
  // Upper-level users see archives for their whole subtree. Bottom-level users see nothing.
  const hasSubordinates = visibleUserIds.length > 1; // visibleUserIds includes self
  const archivedTasks = hasSubordinates
    ? await prisma.task.findMany({
        where: {
          companyId: company.id,
          // See archives for tasks assigned to anyone in subtree
          assigneeId: { in: visibleUserIds },
          isArchived: true,
        },
        orderBy: { completedAt: "desc" },
        take: 50,
        include: {
          creator: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true } },
          assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true } },
        },
      })
    : [];

  // Visible users for assignment (only those below or same level)
  const currentUserData = allUsers.find((u) => u.id === user.userId);
  const assignableUsers = allUsers.filter(
    (u) => (u.roleLevel?.level ?? 0) >= (currentUserData?.roleLevel?.level ?? 0)
  );

  const pendingApprovals = await countPendingApprovalsForUser(company.id, user.userId);

  return (
    <TenantLayout user={user} companyName={company.name} companyLogoUrl={company.logoUrl} slug={slug} modules={company.modules} pendingApprovals={pendingApprovals}>
      <Suspense fallback={<div className="p-6 text-sm text-surface-500">Loading tasks…</div>}>
        <TasksBoard
          user={user}
          tasks={tasks as any}
          archivedTasks={archivedTasks as any}
          canViewArchived={hasSubordinates}
          assignableUsers={assignableUsers as any}
          slug={slug}
          taskStatuses={taskStatuses}
          initialTaskId={sp.task}
          openNew={sp.new === "1"}
          openTaskRequest={sp.request === "1"}
        />
      </Suspense>
    </TenantLayout>
  );
}
