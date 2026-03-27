import { redirect, notFound } from "next/navigation";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlatformLayout from "@/components/layout/PlatformLayout";
import CompanyDetail from "@/components/platform/CompanyDetail";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const user = await getPlatformUser();
  if (!user) redirect("/platform/login");

  const { id } = await params;

  if (!id) notFound();

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      roleLevels: { orderBy: { level: "asc" } },
      billing: true,
      _count: { select: { users: true, tasks: true, ideas: true, recurringTasks: true } },
      users: {
        where: { isSuperAdmin: true },
        select: { id: true, email: true, firstName: true, lastName: true },
        take: 1,
      },
    },
  });

  if (!company) notFound();

  const companyProps = {
    id: company.id,
    name: company.name,
    slug: company.slug,
    isActive: company.isActive,
    modules: company.modules,
    billing: company.billing
      ? {
          id: company.billing.id,
          plan: company.billing.plan,
          pricePerSeat: company.billing.pricePerSeat,
          aiAddonEnabled: company.billing.aiAddonEnabled,
          aiPricePerSeat: company.billing.aiPricePerSeat,
          seatsLimit: company.billing.seatsLimit,
          billingEmail: company.billing.billingEmail,
          notes: company.billing.notes,
          trialEndsAt: company.billing.trialEndsAt?.toISOString() ?? null,
          subscriptionId: company.billing.subscriptionId,
          subscriptionStatus: company.billing.subscriptionStatus,
        }
      : null,
    _count: company._count,
    roleLevels: company.roleLevels.map((rl) => ({
      id: rl.id,
      name: rl.name,
      level: rl.level,
      color: rl.color,
      canApprove: rl.canApprove,
    })),
    users: company.users,
  };

  return (
    <PlatformLayout user={user}>
      <CompanyDetail company={companyProps} />
    </PlatformLayout>
  );
}
