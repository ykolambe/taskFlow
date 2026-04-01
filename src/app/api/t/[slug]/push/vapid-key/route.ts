import { NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { isPushConfigured } from "@/lib/pushNotifications";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push notifications are not configured on this server" }, { status: 503 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return NextResponse.json({ success: true, publicKey });
}
