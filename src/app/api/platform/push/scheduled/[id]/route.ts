import { NextResponse } from "next/server";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getPlatformUser();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.scheduledPush.findFirst({
    where: { id, createdByPlatformOwnerId: owner.id },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending jobs can be cancelled" }, { status: 400 });
  }

  await prisma.scheduledPush.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ success: true });
}
