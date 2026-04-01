import { NextRequest, NextResponse } from "next/server";
import { dispatchDueScheduledPushes } from "@/lib/pushNotifications";

/**
 * Cron: POST or GET with Authorization: Bearer CRON_SECRET or ?secret=
 */
export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}

function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const q = req.nextUrl.searchParams.get("secret");
  if (bearer !== secret && q !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return dispatchDueScheduledPushes()
    .then((r) => NextResponse.json({ success: true, data: r }))
    .catch((e) =>
      NextResponse.json(
        { error: e instanceof Error ? e.message : "Dispatch failed" },
        { status: 500 }
      )
    );
}
