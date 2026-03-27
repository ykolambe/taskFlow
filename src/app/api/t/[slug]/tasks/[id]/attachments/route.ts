import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

type Params = { params: Promise<{ slug: string; id: string }> };

/** POST — save an already-uploaded file as an attachment on a task */
export async function POST(req: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.companyId !== user.companyId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  try {
    const { url, fileName, fileSize, mimeType, key } = await req.json();

    if (!url || !fileName) {
      return NextResponse.json({ error: "url and fileName are required" }, { status: 400 });
    }

    const attachment = await prisma.attachment.create({
      data: {
        taskId: id,
        uploaderId: user.userId,
        fileName,
        fileUrl: url,
        fileSize: fileSize ?? 0,
        mimeType: mimeType ?? "application/octet-stream",
      },
    });

    return NextResponse.json({ success: true, data: attachment });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save attachment" }, { status: 500 });
  }
}

/** DELETE — remove an attachment record (and optionally the file from storage) */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { attachmentId, storageKey } = await req.json();
    if (!attachmentId) return NextResponse.json({ error: "attachmentId required" }, { status: 400 });

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, taskId: id },
    });
    if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only uploader or super admin can delete
    if (attachment.uploaderId !== user.userId && !user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.attachment.delete({ where: { id: attachmentId } });

    // Try to remove from storage (S3/local) — non-fatal if it fails
    if (storageKey) {
      await deleteFile(storageKey).catch((e) => console.warn("[storage delete]", e));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 });
  }
}
