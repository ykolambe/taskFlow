import { redirect } from "next/navigation";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlatformLayout from "@/components/layout/PlatformLayout";
import PlatformBilling from "@/components/platform/PlatformBilling";

export default async function BillingPage() {
  const user = await getPlatformUser();
  if (!user) redirect("/platform/login");

  const config = await prisma.billingConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      billing: true,
      _count: { select: { users: true, tasks: true } },
    },
  });

  const configProps = {
    id: config.id,
    defaultPricePerSeat: config.defaultPricePerSeat,
    currency: config.currency,
    billingCycle: config.billingCycle,
    updatedAt: config.updatedAt.toISOString(),
  };

  const companiesProps = companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    billing: c.billing
      ? {
          id: c.billing.id,
          companyId: c.billing.companyId,
          plan: c.billing.plan,
          pricePerSeat: c.billing.pricePerSeat,
          seatsLimit: c.billing.seatsLimit,
          billingEmail: c.billing.billingEmail,
          subscriptionStatus: c.billing.subscriptionStatus,
          trialEndsAt: c.billing.trialEndsAt?.toISOString() ?? null,
        }
      : null,
    _count: c._count,
  }));

  return (
    <PlatformLayout user={user}>
      <PlatformBilling config={configProps} companies={companiesProps} />
    </PlatformLayout>
  );
}
