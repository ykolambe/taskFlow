import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripeServer";
import { fulfillPendingTenantFromCheckoutSession } from "@/lib/stripeCheckoutFulfillment";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    console.error("Stripe webhook signature failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const already = await prisma.processedStripeEvent.findUnique({ where: { id: event.id } });
  if (already) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    try {
      const cpe = (sub as unknown as { current_period_end?: number }).current_period_end;
      await prisma.companyBilling.updateMany({
        where: { subscriptionId: sub.id },
        data: {
          subscriptionStatus: sub.status,
          subscriptionCurrentPeriodEnd: typeof cpe === "number" ? new Date(cpe * 1000) : null,
        },
      });
    } catch (e) {
      console.error("Stripe webhook subscription sync failed", e);
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      const result = await fulfillPendingTenantFromCheckoutSession(session);

      if (result.kind === "skipped") {
        await prisma.processedStripeEvent.create({ data: { id: event.id } });
        return NextResponse.json({ received: true, skipped: true });
      }
      if (result.kind === "pending_missing") {
        await prisma.processedStripeEvent.create({ data: { id: event.id } });
        return NextResponse.json({ received: true, pendingMissing: true });
      }
      if (result.kind === "already_fulfilled") {
        await prisma.processedStripeEvent.create({ data: { id: event.id } });
        return NextResponse.json({ received: true, duplicate: true });
      }
      // fulfilled
    } catch (e) {
      console.error("Stripe webhook provisioning failed", e);
      return NextResponse.json({ error: "Provisioning failed" }, { status: 500 });
    }
  }

  await prisma.processedStripeEvent.create({ data: { id: event.id } });
  return NextResponse.json({ received: true });
}
