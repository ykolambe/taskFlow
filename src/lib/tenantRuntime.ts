import { prisma } from "@/lib/prisma";
import { isPaidSubscriptionAccessOk } from "@/lib/planEntitlements";

export interface ResolvedTenantRuntime {
  companyId: string;
  slug: string;
  deploymentMode: "SHARED" | "DEDICATED";
  backendBaseUrl: string | null;
  frontendBaseUrl: string | null;
}

export async function resolveTenantRuntimeBySlug(slug: string): Promise<ResolvedTenantRuntime | null> {
  const company = await prisma.company.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      infraConfig: {
        select: {
          deploymentMode: true,
          backendBaseUrl: true,
          frontendBaseUrl: true,
        },
      },
    },
  });
  if (!company) return null;

  return {
    companyId: company.id,
    slug: company.slug,
    deploymentMode: company.infraConfig?.deploymentMode ?? "SHARED",
    backendBaseUrl: company.infraConfig?.backendBaseUrl ?? null,
    frontendBaseUrl: company.infraConfig?.frontendBaseUrl ?? null,
  };
}

/**
 * Company has purchased the module + subscription is active + this user is granted access.
 */
export async function isModuleEnabledForUser(
  companyId: string,
  userId: string,
  moduleKey: "chat" | "recurring"
): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      modules: true,
      billing: {
        select: {
          chatAddonEnabled: true,
          recurringAddonEnabled: true,
          plan: true,
          subscriptionStatus: true,
          subscriptionCurrentPeriodEnd: true,
        },
      },
    },
  });
  if (!company) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chatAddonAccess: true, recurringAddonAccess: true },
  });
  if (!user) return false;

  const hasModule = company.modules.includes(moduleKey);
  const hasCompanyAddon =
    moduleKey === "chat" ? Boolean(company.billing?.chatAddonEnabled) : Boolean(company.billing?.recurringAddonEnabled);
  const hasUserGrant = moduleKey === "chat" ? user.chatAddonAccess : user.recurringAddonAccess;
  if (!hasModule || !hasCompanyAddon || !hasUserGrant) return false;
  if (!company.billing || !isPaidSubscriptionAccessOk(company.billing)) return false;
  return true;
}
