import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string; id: string }> };

async function getIdea(id: string, companyId: string, userId: string) {
  const idea = await prisma.idea.findUnique({ where: { id } });
  if (!idea || idea.companyId !== companyId || idea.userId !== userId) return null;
  return idea;
}

/** PATCH — update idea fields or pin/unpin */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idea = await getIdea(id, user.companyId, user.userId);
  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });

  try {
    const { title, body, color, status, isPinned } = await req.json();

    const updated = await prisma.idea.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(body !== undefined && { body: body?.trim() || null }),
        ...(color !== undefined && { color }),
        ...(status !== undefined && { status }),
        ...(isPinned !== undefined && { isPinned }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update idea" }, { status: 500 });
  }
}

/** DELETE — remove an idea */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idea = await getIdea(id, user.companyId, user.userId);
  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });

  await prisma.idea.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
