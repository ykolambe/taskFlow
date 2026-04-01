import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import TeamPage from "@/components/tenant/TeamPage";
import { getDirectReportIds, buildTeamWorkloadRows } from "@/lib/subtreeWorkload";
import { countPendingApprovalsForUser } from "@/lib/approvalRequestCounts";

export default async function TeamServerPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({
    where: { slug },
    include: { roleLevels: { orderBy: { level: "asc" } }, billing: true },
  });
  if (!company || !company.isActive) notFound();

  const allUsers = await prisma.user.findMany({
    where: { companyId: company.id, isActive: true, isTenantBootstrapAccount: false },
    include: {
      roleLevel: true,
      _count: { select: { assignedTasks: { where: { isArchived: false, status: { not: "COMPLETED" } } }, children: true } },
    },
    orderBy: [{ roleLevel: { level: "asc" } }, { firstName: "asc" }],
  });

  // Full roster (same scope as Org Chart). TeamPage still limits remove/edit actions by hierarchy.
  const visibleUsers = allUsers;

  const subtreeRefs = allUsers.map((u) => ({ id: u.id, parentId: u.parentId }));
  const directReportIds = getDirectReportIds(subtreeRefs, user.userId);

  const [statusConfigs, workloadTasks] = await Promise.all([
    prisma.taskStatusConfig.findMany({ where: { companyId: company.id } }),
    directReportIds.length > 0
      ? prisma.task.findMany({
          where: {
            companyId: company.id,
            assigneeId: { in: directReportIds },
            isArchived: false,
          },
          select: { assigneeId: true, status: true, dueDate: true, priority: true },
        })
      : Promise.resolve([]),
  ]);

  const doneKeys = new Set(statusConfigs.filter((s) => s.type === "DONE").map((s) => s.key));
  const workloadRows = buildTeamWorkloadRows(
    directReportIds,
    workloadTasks,
    doneKeys,
    visibleUsers.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarUrl: u.avatarUrl,
      roleLevel: u.roleLevel,
    })),
    new Date()
  );

  const pendingApprovals = await countPendingApprovalsForUser(company.id, user.userId);

  return (
    <TenantLayout user={user} companyName={company.name} companyLogoUrl={company.logoUrl} slug={slug} modules={company.modules} pendingApprovals={pendingApprovals}>
      <TeamPage
        currentUser={user}
        users={visibleUsers as any}
        roleLevels={company.roleLevels}
        slug={slug}
        companyId={company.id}
        billingAddons={{
          chat: company.billing?.chatAddonEnabled ?? false,
          recurring: company.billing?.recurringAddonEnabled ?? false,
          ai: company.billing?.aiAddonEnabled ?? false,
        }}
        workloadRows={workloadRows}
      />
    </TenantLayout>
  );
}
