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
      infraConfig: true,
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
          chatAddonEnabled: company.billing.chatAddonEnabled,
          chatPricePerSeat: company.billing.chatPricePerSeat,
          recurringAddonEnabled: company.billing.recurringAddonEnabled,
          recurringPricePerSeat: company.billing.recurringPricePerSeat,
          seatsLimit: company.billing.seatsLimit,
          billingEmail: company.billing.billingEmail,
          notes: company.billing.notes,
          trialEndsAt: company.billing.trialEndsAt?.toISOString() ?? null,
          subscriptionId: company.billing.subscriptionId,
          subscriptionStatus: company.billing.subscriptionStatus,
        }
      : null,
    infraConfig: company.infraConfig
      ? {
          deploymentMode: company.infraConfig.deploymentMode,
          provisioningStatus: company.infraConfig.provisioningStatus,
          provisioningError: company.infraConfig.provisioningError,
          backendBaseUrl: company.infraConfig.backendBaseUrl,
          backendIp: company.infraConfig.backendIp,
          frontendBaseUrl: company.infraConfig.frontendBaseUrl,
          frontendIp: company.infraConfig.frontendIp,
          dbHost: company.infraConfig.dbHost,
          dbPort: company.infraConfig.dbPort,
          dbName: company.infraConfig.dbName,
          dbUserSecretRef: company.infraConfig.dbUserSecretRef,
          dbPasswordSecretRef: company.infraConfig.dbPasswordSecretRef,
          dbUrlSecretRef: company.infraConfig.dbUrlSecretRef,
          aiProvider: company.infraConfig.aiProvider,
          aiModel: company.infraConfig.aiModel,
          aiApiKeySecretRef: company.infraConfig.aiApiKeySecretRef,
          aiBaseUrl: company.infraConfig.aiBaseUrl,
          aiRequestBudgetDaily: company.infraConfig.aiRequestBudgetDaily,
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
