import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPublicAppOrigin } from "@/lib/publicAppUrl";
import { getStripe } from "@/lib/stripeServer";
import { takePublicRateLimit, clientKeyFromRequest } from "@/lib/publicRateLimit";
import { verifyWorkspaceSignupEmailToken } from "@/lib/workspaceSignupVerification";
import { createTenantWorkspace } from "@/lib/tenantOnboarding";
import { getDefaultFreeSeatLimit } from "@/lib/planEntitlements";

const bodySchema = z.object({
  plan: z.enum(["free", "pro"]),
  name: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  emailVerificationToken: z.string().min(20),
  modules: z.array(z.string()).optional(),
  chatAddonEnabled: z.boolean().optional(),
  recurringAddonEnabled: z.boolean().optional(),
  aiAddonEnabled: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (process.env.PUBLIC_SIGNUP_ENABLED !== "true") {
    return NextResponse.json({ error: "Self-service signup is not enabled" }, { status: 403 });
  }

  const key = `checkout:${clientKeyFromRequest(req)}`;
  if (!takePublicRateLimit(key, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const data = parsed.data;
    const normalizedSlug = data.slug.toLowerCase().trim();
    const normalizedEmail = data.email.toLowerCase().trim();

    let verifiedEmail: string;
    try {
      const v = await verifyWorkspaceSignupEmailToken(data.emailVerificationToken);
      verifiedEmail = v.email;
    } catch {
      return NextResponse.json(
        { error: "Email verification expired or invalid. Verify your email again." },
        { status: 401 }
      );
    }
    if (verifiedEmail !== normalizedEmail) {
      return NextResponse.json(
        { error: "Email does not match verification. Use the same email you verified." },
        { status: 400 }
      );
    }

    const taken = await prisma.company.findUnique({ where: { slug: normalizedSlug } });
    if (taken) {
      return NextResponse.json({ error: "This workspace URL is already taken" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const origin = getPublicAppOrigin(req);

    if (data.plan === "free") {
      const modules = ["tasks", "team", "org", "approvals", "ideas"];
      const result = await createTenantWorkspace({
        name: data.name.trim(),
        slug: normalizedSlug,
        modules,
        admin: {
          type: "self_service",
          email: normalizedEmail,
          passwordHash,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
        },
        billing: {
          plan: "FREE",
          subscriptionStatus: "active",
          seatsLimit: getDefaultFreeSeatLimit(),
          chatAddonEnabled: false,
          recurringAddonEnabled: false,
          aiAddonEnabled: false,
        },
        runtimeBaseUrl: origin,
        req,
        provisioningJobSource: "self_service_free_signup",
      });

      return NextResponse.json({
        slug: result.normalizedSlug,
        redirect: `/t/${encodeURIComponent(result.normalizedSlug)}/login`,
      });
    }

    const basePrice = process.env.STRIPE_PRICE_BASE_SUBSCRIPTION;
    if (!basePrice) {
      return NextResponse.json({ error: "Checkout is not configured" }, { status: 503 });
    }

    const chatOn = data.chatAddonEnabled ?? false;
    const recOn = data.recurringAddonEnabled ?? false;
    const baseMods = data.modules ?? ["tasks", "team", "org", "approvals", "ideas"];
    const modules = [...baseMods];
    if (chatOn && !modules.includes("chat")) modules.push("chat");
    if (recOn && !modules.includes("recurring")) modules.push("recurring");

    const payload = {
      plan: "PRO" as const,
      name: data.name.trim(),
      slug: normalizedSlug,
      modules,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: normalizedEmail,
      passwordHash,
      chatAddonEnabled: chatOn,
      recurringAddonEnabled: recOn,
      aiAddonEnabled: data.aiAddonEnabled ?? false,
    };

    const pending = await prisma.pendingTenantSignup.create({
      data: { payload: payload as object },
    });

    const lineItems: { price: string; quantity: number }[] = [{ price: basePrice, quantity: 1 }];

    const chat = process.env.STRIPE_PRICE_ADDON_CHAT;
    const recurring = process.env.STRIPE_PRICE_ADDON_RECURRING;
    const ai = process.env.STRIPE_PRICE_ADDON_AI;

    if (payload.chatAddonEnabled) {
      if (!chat) return NextResponse.json({ error: "Chat add-on is not configured" }, { status: 503 });
      lineItems.push({ price: chat, quantity: 1 });
    }
    if (payload.recurringAddonEnabled) {
      if (!recurring) return NextResponse.json({ error: "Recurring add-on is not configured" }, { status: 503 });
      lineItems.push({ price: recurring, quantity: 1 });
    }
    if (payload.aiAddonEnabled) {
      if (!ai) return NextResponse.json({ error: "AI add-on is not configured" }, { status: 503 });
      lineItems.push({ price: ai, quantity: 1 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: payload.email,
      line_items: lineItems,
      client_reference_id: pending.id,
      success_url: `${origin}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/signup?canceled=1`,
      metadata: {
        pendingTenantSignupId: pending.id,
      },
      subscription_data: {
        metadata: {
          pendingTenantSignupId: pending.id,
        },
      },
    });

    if (session.id) {
      await prisma.pendingTenantSignup.update({
        where: { id: pending.id },
        data: { stripeSessionId: session.id },
      });
    }

    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
