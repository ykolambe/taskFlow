import { NextResponse } from "next/server";
import { getDefaultFreeSeatLimit } from "@/lib/planEntitlements";

export async function GET() {
  const freeSeats = getDefaultFreeSeatLimit();

  return NextResponse.json({
    enabled: process.env.PUBLIC_SIGNUP_ENABLED === "true",
    plans: {
      free: {
        key: "free",
        label: "Free",
        priceLabel: "$0",
        seatLimit: freeSeats,
        description: `Up to ${freeSeats} members · Tasks, team, org, approvals, ideas`,
      },
      pro: {
        key: "pro",
        label: "Pro",
        priceLabel: process.env.NEXT_PUBLIC_PRO_PRICE_LABEL ?? "Paid (Stripe)",
        seatLimit: null,
        description: "Unlimited members (billed per seat) · Add team chat, recurring tasks, and AI; assign per user",
      },
    },
    addons: {
      chat: { label: "Team chat", priceLabel: process.env.NEXT_PUBLIC_ADDON_CHAT_LABEL ?? "+ Subscription add-on" },
      recurring: {
        label: "Recurring tasks",
        priceLabel: process.env.NEXT_PUBLIC_ADDON_RECURRING_LABEL ?? "+ Subscription add-on",
      },
      ai: { label: "AI assistance", priceLabel: process.env.NEXT_PUBLIC_ADDON_AI_LABEL ?? "+ Subscription add-on" },
    },
  });
}
