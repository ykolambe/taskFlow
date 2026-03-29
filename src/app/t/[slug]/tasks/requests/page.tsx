import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import TaskRequestsInbox from "@/components/tenant/TaskRequestsInbox";
import { countPendingApprovalsForUser } from "@/lib/approvalRequestCounts";

export default async function TaskRequestsPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company || !company.isActive) notFound();

  if (!company.modules.includes("tasks")) {
    notFound();
  }

  const pendingApprovals = await countPendingApprovalsForUser(company.id, user.userId);

  return (
    <TenantLayout
      user={user}
      companyName={company.name}
      companyLogoUrl={company.logoUrl}
      slug={slug}
      modules={company.modules}
      pendingApprovals={pendingApprovals}
    >
      <div className="p-4 sm:p-6">
        <TaskRequestsInbox user={user} slug={slug} />
      </div>
    </TenantLayout>
  );
}
