import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchReportingLinksForCompany, getPrimarySubtreeIds } from "@/lib/reportingLinks";
import TenantLayout from "@/components/layout/TenantLayout";
import RecurringTasksPage from "@/components/tenant/RecurringTasksPage";
import { countPendingApprovalsForUser } from "@/lib/approvalRequestCounts";

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company || !company.isActive) notFound();

  const [allUsers, reportingLinks] = await Promise.all([
    prisma.user.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        OR: [{ id: user.userId }, { isTenantBootstrapAccount: false }],
      },
      include: { roleLevel: true },
      orderBy: { firstName: "asc" },
    }),
    fetchReportingLinksForCompany(prisma, company.id),
  ]);
  const visibleIds = getPrimarySubtreeIds(reportingLinks, user.userId);

  // Fetch recurring tasks visible to this user
  const recurring = await prisma.recurringTask.findMany({
    where: { companyId: company.id, assigneeId: { in: visibleIds } },
    include: {
      creator: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, roleLevel: true, roleLevelId: true, email: true, username: true, isSuperAdmin: true },
      },
      assignee: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, roleLevel: true, roleLevelId: true, email: true, username: true, isSuperAdmin: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Users this person can assign to (self + subordinates)
  const currentUserData = allUsers.find((u) => u.id === user.userId);
  const currentLevel = currentUserData?.roleLevel?.level ?? 0;
  const assignableUsers = allUsers.filter(
    (u) => (u.roleLevel?.level ?? 0) >= currentLevel
  );

  const pendingApprovals = await countPendingApprovalsForUser(company.id, user.userId);

  return (
    <TenantLayout user={user} companyName={company.name} companyLogoUrl={company.logoUrl} slug={slug} modules={company.modules} pendingApprovals={pendingApprovals}>
      <RecurringTasksPage
        user={user}
        initialRecurring={recurring as any}
        assignableUsers={assignableUsers as any}
        slug={slug}
      />
    </TenantLayout>
  );
}
