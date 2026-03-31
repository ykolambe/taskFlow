import { NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  countActiveSeats,
  effectiveSeatLimit,
  isPaidSubscriptionAccessOk,
} from "@/lib/planEntitlements";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, modules: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const billing = await prisma.companyBilling.findUnique({
    where: { companyId: company.id },
  });

  const plan = (billing?.plan ?? "FREE").toUpperCase();
  const paidOk = isPaidSubscriptionAccessOk(billing);
  const seatsUsed = await countActiveSeats(company.id);
  const seatsLimit = effectiveSeatLimit(billing);

  const hasPaidSub = Boolean(billing?.subscriptionId);
  const showExpiredBanner = plan !== "FREE" && hasPaidSub && !paidOk;
  const showFreeUpgradeCta = user.isSuperAdmin && plan === "FREE";

  const chatAddon = Boolean(billing?.chatAddonEnabled);
  const recAddon = Boolean(billing?.recurringAddonEnabled);
  const showChatNav = company.modules.includes("chat") && chatAddon && paidOk;
  const showRecurringNav = company.modules.includes("recurring") && recAddon && paidOk;

  return NextResponse.json({
    plan,
    subscriptionStatus: billing?.subscriptionStatus ?? null,
    subscriptionCurrentPeriodEnd: billing?.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
    paidSubscriptionActive: paidOk,
    seatsUsed,
    seatsLimit,
    showExpiredBanner,
    showFreeUpgradeCta,
    isSuperAdmin: user.isSuperAdmin,
    showChatNav,
    showRecurringNav,
  });
}
