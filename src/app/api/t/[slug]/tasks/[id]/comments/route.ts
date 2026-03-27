import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  roleLevelId: true,
  roleLevel: true,
  email: true,
  username: true,
  isSuperAdmin: true,
};

type Params = { params: Promise<{ slug: string; id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id }, select: { companyId: true } });
  if (!task || task.companyId !== user.companyId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const comments = await prisma.taskComment.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return NextResponse.json({ success: true, data: comments });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id }, select: { companyId: true } });
  if (!task || task.companyId !== user.companyId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  try {
    const { body } = await req.json();
    if (!body || !body.trim()) {
      return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
    }
    if (body.length > 2000) {
      return NextResponse.json({ error: "Comment must be under 2000 characters" }, { status: 400 });
    }

    const comment = await prisma.taskComment.create({
      data: { taskId: id, authorId: user.userId, body: body.trim() },
      include: { author: { select: AUTHOR_SELECT } },
    });

    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
