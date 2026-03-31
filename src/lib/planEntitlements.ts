import type { CompanyBilling } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function getDefaultFreeSeatLimit(): number {
  const n = parseInt(process.env.FREE_PLAN_SEAT_LIMIT ?? "5", 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

/** Paid plan (PRO) subscription grants access to Stripe-backed features until period end. */
export function isPaidSubscriptionAccessOk(
  billing: Pick<CompanyBilling, "plan" | "subscriptionStatus" | "subscriptionCurrentPeriodEnd"> | null
): boolean {
  if (!billing) return true;
  const plan = (billing.plan ?? "FREE").toUpperCase();
  if (plan === "FREE") return true;

  const st = (billing.subscriptionStatus ?? "").toLowerCase();
  if (st === "active" || st === "trialing") return true;

  const end = billing.subscriptionCurrentPeriodEnd;
  if (end && end.getTime() > Date.now()) return true;

  return false;
}

/**
 * Seat cap for enforcement. Free tier is capped; active Pro is unlimited (null) — bill per seat in Stripe.
 */
export function effectiveSeatLimit(
  billing: Pick<CompanyBilling, "plan" | "seatsLimit" | "subscriptionStatus" | "subscriptionCurrentPeriodEnd"> | null
): number | null {
  if (!billing) return getDefaultFreeSeatLimit();
  const plan = (billing.plan ?? "FREE").toUpperCase();
  if (plan === "FREE") {
    return billing.seatsLimit ?? getDefaultFreeSeatLimit();
  }
  if (!isPaidSubscriptionAccessOk(billing)) {
    return getDefaultFreeSeatLimit();
  }
  return null;
}

export async function countActiveSeats(companyId: string): Promise<number> {
  return prisma.user.count({ where: { companyId, isActive: true } });
}

export async function canAddSeat(companyId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const billing = await prisma.companyBilling.findUnique({ where: { companyId } });
  const limit = effectiveSeatLimit(billing);
  if (limit == null) return { ok: true };
  const used = await countActiveSeats(companyId);
  if (used >= limit) {
    return {
      ok: false,
      reason: `Seat limit reached (${used}/${limit}). Upgrade your plan or remove users.`,
    };
  }
  return { ok: true };
}
