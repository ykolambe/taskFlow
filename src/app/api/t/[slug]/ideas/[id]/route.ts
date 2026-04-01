import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string; id: string }> };
type IdeaTag = { name: string; color: string };
type IdeaPage = { id: string; title: string; content: string; updatedAt: string };

function sanitizeTags(input: unknown): IdeaTag[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((t) => {
      if (!t || typeof t !== "object") return null;
      const raw = t as Record<string, unknown>;
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      const color = typeof raw.color === "string" ? raw.color.trim() : "";
      if (!name || !color) return null;
      return { name: name.slice(0, 32), color: color.slice(0, 20) };
    })
    .filter((v): v is IdeaTag => Boolean(v))
    .slice(0, 20);
}

function sanitizePages(input: unknown): IdeaPage[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const raw = p as Record<string, unknown>;
      const id = typeof raw.id === "string" ? raw.id.trim() : "";
      const title = typeof raw.title === "string" ? raw.title.trim() : "";
      const content = typeof raw.content === "string" ? raw.content : "";
      const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString();
      if (!id || !title) return null;
      return {
        id: id.slice(0, 64),
        title: title.slice(0, 120),
        content: content.slice(0, 30_000),
        updatedAt,
      };
    })
    .filter((v): v is IdeaPage => Boolean(v))
    .slice(0, 40);
}

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
    const { title, body, color, status, isPinned, tags, pages } = await req.json();

    const updated = await prisma.idea.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(body !== undefined && { body: body?.trim() || null }),
        ...(color !== undefined && { color }),
        ...(status !== undefined && { status }),
        ...(isPinned !== undefined && { isPinned }),
        ...(tags !== undefined && { tags: sanitizeTags(tags) }),
        ...(pages !== undefined && { pages: sanitizePages(pages) }),
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
