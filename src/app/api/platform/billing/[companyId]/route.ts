import { NextRequest, NextResponse } from "next/server";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ companyId: string }> };

/**
 * GET /api/platform/billing/[companyId]
 * Returns the CompanyBilling record + live usage counts.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;

  const [company, billing, config] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: { select: { users: true, tasks: true, ideas: true, recurringTasks: true } },
      },
    }),
    prisma.companyBilling.findUnique({ where: { companyId } }),
    prisma.billingConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }),
  ]);

  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  return NextResponse.json({ success: true, billing, company, config });
}

/**
 * PATCH /api/platform/billing/[companyId]
 * Upsert CompanyBilling for a specific company.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  try {
    const {
      plan,
      pricePerSeat,
      aiAddonEnabled,
      aiPricePerSeat,
      chatAddonEnabled,
      chatPricePerSeat,
      recurringAddonEnabled,
      recurringPricePerSeat,
      seatsLimit,
      billingEmail,
      notes,
      trialEndsAt,
      subscriptionId,
      subscriptionStatus,
    } = await req.json();

    const billing = await prisma.companyBilling.upsert({
      where: { companyId },
      update: {
        ...(plan !== undefined && { plan }),
        // Allow explicit null to "reset to default"
        ...(pricePerSeat !== undefined && {
          pricePerSeat: pricePerSeat === null || pricePerSeat === "" ? null : Number(pricePerSeat),
        }),
        ...(aiAddonEnabled !== undefined && { aiAddonEnabled: Boolean(aiAddonEnabled) }),
        ...(aiPricePerSeat !== undefined && {
          aiPricePerSeat: aiPricePerSeat === null || aiPricePerSeat === "" ? null : Number(aiPricePerSeat),
        }),
        ...(chatAddonEnabled !== undefined && { chatAddonEnabled: Boolean(chatAddonEnabled) }),
        ...(chatPricePerSeat !== undefined && {
          chatPricePerSeat: chatPricePerSeat === null || chatPricePerSeat === "" ? null : Number(chatPricePerSeat),
        }),
        ...(recurringAddonEnabled !== undefined && { recurringAddonEnabled: Boolean(recurringAddonEnabled) }),
        ...(recurringPricePerSeat !== undefined && {
          recurringPricePerSeat: recurringPricePerSeat === null || recurringPricePerSeat === "" ? null : Number(recurringPricePerSeat),
        }),
        ...(seatsLimit !== undefined && {
          seatsLimit: seatsLimit === null || seatsLimit === "" ? null : Number(seatsLimit),
        }),
        ...(billingEmail !== undefined && { billingEmail: billingEmail || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(trialEndsAt !== undefined && {
          trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
        }),
        ...(subscriptionId !== undefined && { subscriptionId: subscriptionId || null }),
        ...(subscriptionStatus !== undefined && { subscriptionStatus }),
      },
      create: {
        companyId,
        plan: plan ?? "FREE",
        pricePerSeat: pricePerSeat !== undefined && pricePerSeat !== "" ? Number(pricePerSeat) : null,
        aiAddonEnabled: aiAddonEnabled ?? false,
        aiPricePerSeat: aiPricePerSeat !== undefined && aiPricePerSeat !== "" ? Number(aiPricePerSeat) : null,
        chatAddonEnabled: chatAddonEnabled ?? false,
        chatPricePerSeat: chatPricePerSeat !== undefined && chatPricePerSeat !== "" ? Number(chatPricePerSeat) : null,
        recurringAddonEnabled: recurringAddonEnabled ?? false,
        recurringPricePerSeat:
          recurringPricePerSeat !== undefined && recurringPricePerSeat !== "" ? Number(recurringPricePerSeat) : null,
        seatsLimit: seatsLimit !== undefined && seatsLimit !== "" ? Number(seatsLimit) : null,
        billingEmail: billingEmail || null,
        notes: notes || null,
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
        subscriptionId: subscriptionId || null,
        subscriptionStatus: subscriptionStatus ?? "active",
      },
    });

    return NextResponse.json({ success: true, billing });
  } catch (err) {
    console.error("Billing upsert failed", err);
    const message =
      err instanceof Error && err.message.includes("Unknown argument `aiAddonEnabled`")
        ? "Server Prisma client is stale. Run `npx prisma generate` and restart `npm run dev`."
        : "Failed to save billing settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
