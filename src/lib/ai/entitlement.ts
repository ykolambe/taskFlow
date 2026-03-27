import { prisma } from "@/lib/prisma";

export async function isCompanyAiEnabled(companyId: string): Promise<boolean> {
  const billing = await prisma.companyBilling.findUnique({
    where: { companyId },
    select: { aiAddonEnabled: true },
  });
  return Boolean(billing?.aiAddonEnabled);
}

