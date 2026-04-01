import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> };
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
    const { title, body, color, status, tags, pages } = await req.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    let idea;
    try {
      idea = await prisma.idea.create({
        data: {
          companyId: user.companyId,
          userId: user.userId,
          title: title.trim(),
          body: body?.trim() || null,
          color: color || "#6366f1",
          tags: sanitizeTags(tags),
          pages: sanitizePages(pages),
          status: status || "IDEA",
        },
      });
    } catch (e) {
      const isMissingColumn = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022";
      if (!isMissingColumn) throw e;
      // Fallback for environments where DB migration has not yet added tags/pages.
      const ideaId = randomUUID();
      const rows = await prisma.$queryRaw<Array<{
        id: string;
        companyId: string;
        userId: string;
        title: string;
        body: string | null;
        color: string;
        status: string;
        convertedTaskId: string | null;
        isPinned: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>>`
        INSERT INTO "ideas" ("id", "companyId", "userId", "title", "body", "color", "status", "isPinned", "createdAt", "updatedAt")
        VALUES (${ideaId}, ${user.companyId}, ${user.userId}, ${title.trim()}, ${body?.trim() || null}, ${color || "#6366f1"}, ${status || "IDEA"}::"IdeaStatus", false, NOW(), NOW())
        RETURNING "id", "companyId", "userId", "title", "body", "color", "status", "convertedTaskId", "isPinned", "createdAt", "updatedAt"
      `;
      const row = rows[0];
      if (!row) throw new Error("Idea insert fallback failed");
      idea = { ...row, tags: [], pages: [] };
    }

    return NextResponse.json({ success: true, data: idea }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create idea" }, { status: 500 });
  }
}
