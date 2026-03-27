import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> };

/** GET — list all ideas for the current user */
export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ideas = await prisma.idea.findMany({
    where: { companyId: user.companyId, userId: user.userId },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ success: true, data: ideas });
}

/** POST — create a new idea */
export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, body, color, status } = await req.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const idea = await prisma.idea.create({
      data: {
        companyId: user.companyId,
        userId: user.userId,
        title: title.trim(),
        body: body?.trim() || null,
        color: color || "#6366f1",
        status: status || "IDEA",
      },
    });

    return NextResponse.json({ success: true, data: idea }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create idea" }, { status: 500 });
  }
}
