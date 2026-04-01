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

/** Company AI add-on + active subscription + per-user grant OR hierarchy-tier default for that level */
export async function isUserAiEnabled(companyId: string, userId: string): Promise<boolean> {
  const billing = await prisma.companyBilling.findUnique({
    where: { companyId },
    select: {
      aiAddonEnabled: true,
      plan: true,
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
    },
  });
  if (!billing?.aiAddonEnabled || !isPaidSubscriptionAccessOk(billing)) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiAddonAccess: true, roleLevel: { select: { level: true } } },
  });
  if (!user) return false;
  if (user.aiAddonAccess) return true;

  const lv = user.roleLevel?.level;
  if (lv == null) return false;

  const tier = await prisma.companyHierarchyTier.findUnique({
    where: { companyId_level: { companyId, level: lv } },
    select: { defaultAiAddon: true },
  });
  return Boolean(tier?.defaultAiAddon);
}

/** Active users who effectively have AI (for billing / usage). */
export async function countUsersWithEffectiveAi(companyId: string): Promise<number> {
  const billing = await prisma.companyBilling.findUnique({
    where: { companyId },
    select: {
      aiAddonEnabled: true,
      plan: true,
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
    },
  });
  if (!billing?.aiAddonEnabled || !isPaidSubscriptionAccessOk(billing)) return 0;

  const [users, tiers] = await Promise.all([
    prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { aiAddonAccess: true, roleLevel: { select: { level: true } } },
    }),
    prisma.companyHierarchyTier.findMany({
      where: { companyId, defaultAiAddon: true },
      select: { level: true },
    }),
  ]);
  const tierLevels = new Set(tiers.map((t) => t.level));
  let n = 0;
  for (const u of users) {
    if (u.aiAddonAccess) {
      n += 1;
      continue;
    }
    const lv = u.roleLevel?.level;
    if (lv != null && tierLevels.has(lv)) n += 1;
  }
  return n;
}
