import { NextResponse } from "next/server";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await prisma.company.findMany({
    select: { id: true, modules: true },
  });

  let infraUpserts = 0;
  let billingUpserts = 0;
  for (const c of companies) {
    await prisma.tenantInfraConfig.upsert({
      where: { companyId: c.id },
      update: {},
      create: {
        companyId: c.id,
        deploymentMode: "SHARED",
        provisioningStatus: "READY",
      },
    });
    infraUpserts += 1;

    await prisma.companyBilling.upsert({
      where: { companyId: c.id },
      update: {},
      create: {
        companyId: c.id,
        plan: "FREE",
        chatAddonEnabled: c.modules.includes("chat"),
        recurringAddonEnabled: c.modules.includes("recurring"),
      },
    });
    billingUpserts += 1;
  }

  return NextResponse.json({
    success: true,
    migratedCompanies: companies.length,
    infraUpserts,
    billingUpserts,
  });
}

