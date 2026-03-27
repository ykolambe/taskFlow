import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> | { slug: string } };

/** GET — list reminders for the current user (open first, then by time) */
export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const includeDone = req.nextUrl.searchParams.get("includeDone") === "1";
  const rawSkip = parseInt(req.nextUrl.searchParams.get("skip") ?? "0", 10);
  const skip = Number.isFinite(rawSkip) && rawSkip > 0 ? rawSkip : 0;
  const rawTake = parseInt(req.nextUrl.searchParams.get("take") ?? "50", 10);
  const take = Number.isFinite(rawTake) ? Math.min(Math.max(rawTake, 1), 100) : 50;

  const list = await prisma.userReminder.findMany({
    where: {
      companyId: company.id,
      userId: user.userId,
      ...(includeDone ? {} : { isDone: false }),
    },
    orderBy: [{ isDone: "asc" }, { remindAt: "asc" }],
    skip,
    take,
  });

  return NextResponse.json({
    success: true,
    data: list,
    meta: { skip, take, hasMore: list.length === take },
  });
}

/** POST — create reminder */
export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { title?: string; note?: string | null; remindAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const remindAtRaw = body.remindAt;
  if (!remindAtRaw) return NextResponse.json({ error: "remindAt is required" }, { status: 400 });

  const remindAt = new Date(remindAtRaw);
  if (Number.isNaN(remindAt.getTime())) {
    return NextResponse.json({ error: "Invalid remindAt" }, { status: 400 });
  }

  const created = await prisma.userReminder.create({
    data: {
      companyId: company.id,
      userId: user.userId,
      title,
      note: body.note?.trim() || null,
      remindAt,
    },
  });

  return NextResponse.json({ success: true, data: created });
}
