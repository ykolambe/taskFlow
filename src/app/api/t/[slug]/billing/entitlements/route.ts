import { NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countUsersWithEffectiveAi } from "@/lib/ai/entitlement";
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
  const contentAddon = Boolean(billing?.contentStudioAddonEnabled);
  const aiAddon = Boolean(billing?.aiAddonEnabled);
  // Company may enable add-ons via billing only; modules array is kept in sync in most flows but can drift.
  const showChatNav = paidOk && (chatAddon || company.modules.includes("chat"));
  const showRecurringNav = paidOk && (recAddon || company.modules.includes("recurring"));
  const showContentStudioNav = paidOk && (contentAddon || company.modules.includes("content"));
  const aiSeatsUsed =
    aiAddon && paidOk ? await countUsersWithEffectiveAi(company.id) : 0;

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
    showContentStudioNav,
    aiSeatsUsed,
  });
}
