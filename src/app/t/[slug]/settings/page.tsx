import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import TenantSettings from "@/components/tenant/TenantSettings";
import { countPendingApprovalsForUser } from "@/lib/approvalRequestCounts";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);
  if (!user.isSuperAdmin) redirect(`/t/${slug}/dashboard`);

  const [company, taskStatuses] = await Promise.all([
    prisma.company.findUnique({
      where: { slug },
      include: {
        roleLevels: { orderBy: { level: "asc" } },
        hierarchyTiers: { orderBy: { level: "asc" } },
      },
    }),
    prisma.taskStatusConfig.findMany({
      where: { company: { slug } },
      orderBy: { order: "asc" },
    }),
  ]);
  if (!company || !company.isActive) notFound();

  const pendingApprovals = await countPendingApprovalsForUser(company.id, user.userId);

  return (
    <TenantLayout user={user} companyName={company.name} companyLogoUrl={company.logoUrl} slug={slug} modules={company.modules} pendingApprovals={pendingApprovals}>
      <TenantSettings company={company as any} user={user} slug={slug} taskStatuses={taskStatuses} />
    </TenantLayout>
  );
}
