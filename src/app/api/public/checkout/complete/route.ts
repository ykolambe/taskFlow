import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripeServer";
import { fulfillPendingTenantFromCheckoutSession } from "@/lib/stripeCheckoutFulfillment";
import { takePublicRateLimit, clientKeyFromRequest } from "@/lib/publicRateLimit";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().min(10).startsWith("cs_"),
});

/**
 * Browser fallback when Stripe webhooks cannot reach the app (e.g. local dev without Stripe CLI).
 * Call from the signup success page with the Checkout Session ID from the URL.
 */
export async function POST(req: NextRequest) {
  if (process.env.PUBLIC_SIGNUP_ENABLED !== "true") {
    return NextResponse.json({ error: "Self-service signup is not enabled" }, { status: 403 });
  }

  const key = `checkout-complete:${clientKeyFromRequest(req)}`;
  if (!takePublicRateLimit(key, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, {
      expand: ["subscription"],
    });
  } catch (e) {
    console.error("checkout/complete: retrieve session failed", e);
    return NextResponse.json({ error: "Could not verify payment session" }, { status: 400 });
  }

  if (session.mode !== "subscription") {
    return NextResponse.json({ error: "Invalid checkout mode" }, { status: 400 });
  }
  if (session.status !== "complete") {
    return NextResponse.json(
      {
        error: "Checkout session is not complete yet",
        status: session.status,
        payment_status: session.payment_status,
      },
      { status: 409 }
    );
  }
  const paymentReady =
    session.payment_status === "paid" || session.payment_status === "no_payment_required";
  if (!paymentReady) {
    return NextResponse.json(
      {
        error: "Payment is not ready yet; keep polling until paid or no payment is required",
        status: session.status,
        payment_status: session.payment_status,
      },
      { status: 409 }
    );
  }

  try {
    const result = await fulfillPendingTenantFromCheckoutSession(session);

    if (result.kind === "skipped") {
      return NextResponse.json({ error: "Session is missing signup reference" }, { status: 400 });
    }
    if (result.kind === "pending_missing") {
      return NextResponse.json(
        { error: "Signup data not found. If you already finished setup, try logging in." },
        { status: 404 }
      );
    }
    if (result.kind === "already_fulfilled" || result.kind === "fulfilled") {
      return NextResponse.json({ ok: true, slug: result.slug });
    }
  } catch (e) {
    console.error("checkout/complete: provisioning failed", e);
    const message = e instanceof Error ? e.message : "Provisioning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ error: "Unexpected state" }, { status: 500 });
}
