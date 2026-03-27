import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string; id: string; cid: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug, id, cid } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const comment = await prisma.taskComment.findFirst({
    where: { id: cid, taskId: id },
  });
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  if (comment.authorId !== user.userId && !user.isSuperAdmin) {
    return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 });
  }

  await prisma.taskComment.delete({ where: { id: cid } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug, id, cid } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const comment = await prisma.taskComment.findFirst({
    where: { id: cid, taskId: id },
  });
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  if (comment.authorId !== user.userId) {
    return NextResponse.json({ error: "You can only edit your own comments" }, { status: 403 });
  }

  const { body } = await req.json();
  if (!body || !body.trim()) {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  }
  if (body.length > 2000) {
    return NextResponse.json({ error: "Comment must be under 2000 characters" }, { status: 400 });
  }

  const updated = await prisma.taskComment.update({
    where: { id: cid },
    data: { body: body.trim() },
    include: {
      author: {
        select: {
          id: true, firstName: true, lastName: true, avatarUrl: true,
          roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true,
        },
      },
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
