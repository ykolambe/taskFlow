import { prisma } from "@/lib/prisma";
import { isPaidSubscriptionAccessOk } from "@/lib/planEntitlements";

export async function isCompanyAiEnabled(companyId: string): Promise<boolean> {
  const billing = await prisma.companyBilling.findUnique({
    where: { companyId },
    select: {
      aiAddonEnabled: true,
      plan: true,
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
    },
  });
  if (!billing?.aiAddonEnabled) return false;
  return isPaidSubscriptionAccessOk(billing);
}

/** Company AI add-on + active subscription + per-user grant */
export async function isUserAiEnabled(companyId: string, userId: string): Promise<boolean> {
  const [billing, user] = await Promise.all([
    prisma.companyBilling.findUnique({
      where: { companyId },
      select: {
        aiAddonEnabled: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { aiAddonAccess: true },
    }),
  ]);
  if (!billing?.aiAddonEnabled || !user?.aiAddonAccess) return false;
  return isPaidSubscriptionAccessOk(billing);
}
