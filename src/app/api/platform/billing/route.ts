import { NextRequest, NextResponse } from "next/server";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET  /api/platform/billing
 * Returns the global BillingConfig + aggregated usage across all companies.
 */
export async function GET() {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Upsert the singleton so it always exists
  const config = await prisma.billingConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  // Fetch all companies with their billing overrides and usage counts
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      billing: true,
      _count: { select: { users: true, tasks: true } },
    },
  });

  // Compute aggregate stats
  const activeCompanies = companies.filter((c) => c.isActive);
  const totalSeats = companies.reduce((sum, c) => sum + c._count.users, 0);

  const estimatedMRR = activeCompanies.reduce((sum, c) => {
    const price = c.billing?.pricePerSeat ?? config.defaultPricePerSeat;
    const seats = c._count.users;
    const monthly =
      config.billingCycle === "annual"
        ? (price * seats * 12) / 12
        : price * seats;
    return sum + monthly;
  }, 0);

  return NextResponse.json({
    success: true,
    config,
    companies,
    stats: {
      totalCompanies: companies.length,
      activeCompanies: activeCompanies.length,
      totalSeats,
      estimatedMRR,
    },
  });
}

/**
 * PATCH /api/platform/billing
 * Update global billing config (default price, currency, billing cycle).
 */
export async function PATCH(req: NextRequest) {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { defaultPricePerSeat, currency, billingCycle } = await req.json();

  const config = await prisma.billingConfig.upsert({
    where: { id: "default" },
    update: {
      ...(defaultPricePerSeat !== undefined && { defaultPricePerSeat: Number(defaultPricePerSeat) }),
      ...(currency && { currency }),
      ...(billingCycle && { billingCycle }),
    },
    create: {
      id: "default",
      defaultPricePerSeat: Number(defaultPricePerSeat ?? 0),
      currency: currency ?? "USD",
      billingCycle: billingCycle ?? "monthly",
    },
  });

  return NextResponse.json({ success: true, config });
}
