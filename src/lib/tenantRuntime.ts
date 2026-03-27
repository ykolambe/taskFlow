import { prisma } from "@/lib/prisma";

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

export async function isModuleEnabledForCompany(companyId: string, moduleKey: "chat" | "recurring"): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      modules: true,
      billing: {
        select: {
          chatAddonEnabled: true,
          recurringAddonEnabled: true,
        },
      },
    },
  });
  if (!company) return false;

  const hasModule = company.modules.includes(moduleKey);
  const hasAddon = moduleKey === "chat" ? Boolean(company.billing?.chatAddonEnabled) : Boolean(company.billing?.recurringAddonEnabled);
  return hasModule && hasAddon;
}

