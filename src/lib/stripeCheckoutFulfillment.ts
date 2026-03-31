import type Stripe from "stripe";
import { Prisma, type PendingTenantSignup } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTenantWorkspace } from "@/lib/tenantOnboarding";
import { getPublicAppOrigin } from "@/lib/publicAppUrl";
import { getStripe } from "@/lib/stripeServer";

export type PendingSignupPayload = {
  plan?: string;
  name: string;
  slug: string;
  modules: string[];
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  chatAddonEnabled: boolean;
  recurringAddonEnabled: boolean;
  aiAddonEnabled: boolean;
};

export type FulfillCheckoutResult =
  | { kind: "fulfilled"; slug: string }
  | { kind: "skipped"; reason: "no_pending_reference" }
  | { kind: "pending_missing" }
  | { kind: "already_fulfilled"; slug: string };

function pendingIdFromSession(session: Stripe.Checkout.Session): string | null {
  const fromMeta = session.metadata?.pendingTenantSignupId;
  if (typeof fromMeta === "string" && fromMeta.length > 0) return fromMeta;
  const fromRef = session.client_reference_id;
  if (typeof fromRef === "string" && fromRef.length > 0) return fromRef;
  return null;
}

function subscriptionIdFromSession(session: Stripe.Checkout.Session): string | null {
  const sub = session.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && "id" in sub) {
    return (sub as Stripe.Subscription).id;
  }
  return null;
}

/**
 * Creates the tenant workspace from a completed Checkout session (webhook or browser reconcile).
 * Resolves the pending row by `metadata.pendingTenantSignupId` / `client_reference_id` when present,
 * otherwise by `stripeSessionId` matching the Checkout Session id.
 */
export async function fulfillPendingTenantFromCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<FulfillCheckoutResult> {
  const pendingIdFromMeta = pendingIdFromSession(session);
  const subId = subscriptionIdFromSession(session);

  let pending: PendingTenantSignup | null = null;
  if (pendingIdFromMeta) {
    pending = await prisma.pendingTenantSignup.findUnique({ where: { id: pendingIdFromMeta } });
  }
  if (!pending) {
    pending = await prisma.pendingTenantSignup.findFirst({
      where: { stripeSessionId: session.id },
    });
  }

  if (!pending) {
    if (subId) {
      const billing = await prisma.companyBilling.findFirst({
        where: { subscriptionId: subId },
        include: { company: true },
      });
      if (billing?.company) {
        return { kind: "already_fulfilled", slug: billing.company.slug };
      }
    }
    if (!pendingIdFromMeta) {
      return { kind: "skipped", reason: "no_pending_reference" };
    }
    return { kind: "pending_missing" };
  }

  const pendingId = pending.id;
  const payload = pending.payload as unknown as PendingSignupPayload;
  const origin = getPublicAppOrigin(null);

  let subscriptionCurrentPeriodEnd: Date | null = null;
  if (subId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subId);
      const cpe = (sub as unknown as { current_period_end?: number }).current_period_end;
      if (typeof cpe === "number") {
        subscriptionCurrentPeriodEnd = new Date(cpe * 1000);
      }
    } catch (e) {
      console.warn("stripeCheckoutFulfillment: could not retrieve subscription for period end", e);
    }
  }

  try {
    await createTenantWorkspace({
      name: payload.name,
      slug: payload.slug,
      modules: payload.modules,
      admin: {
        type: "self_service",
        email: payload.email,
        passwordHash: payload.passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName,
      },
      billing: {
        plan: "PRO",
        subscriptionId: subId,
        subscriptionStatus: "active",
        subscriptionCurrentPeriodEnd,
        seatsLimit: null,
        chatAddonEnabled: payload.chatAddonEnabled,
        recurringAddonEnabled: payload.recurringAddonEnabled,
        aiAddonEnabled: payload.aiAddonEnabled,
      },
      runtimeBaseUrl: origin,
      req: null,
      provisioningJobSource: "stripe_checkout",
    });

    await prisma.pendingTenantSignup.delete({ where: { id: pendingId } });
    return { kind: "fulfilled", slug: payload.slug };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && subId) {
      const slug = payload.slug.toLowerCase().trim();
      const company = await prisma.company.findUnique({ where: { slug } });
      if (company) {
        const billing = await prisma.companyBilling.findUnique({ where: { companyId: company.id } });
        if (billing?.subscriptionId === subId) {
          await prisma.pendingTenantSignup.delete({ where: { id: pendingId } }).catch(() => {});
          return { kind: "already_fulfilled", slug: company.slug };
        }
      }
    }
    throw e;
  }
}
