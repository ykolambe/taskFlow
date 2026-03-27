import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string; id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user?.isSuperAdmin) return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = await prisma.taskStatusConfig.findFirst({
    where: { id, companyId: company.id },
  });
  if (!config) return NextResponse.json({ error: "Status not found" }, { status: 404 });

  // Prevent deleting the only OPEN or DONE status
  if (config.type === "OPEN" || config.type === "DONE") {
    return NextResponse.json(
      { error: `The "${config.type}" status is required and cannot be deleted.` },
      { status: 400 }
    );
  }

  // Reassign tasks using this status to the OPEN status
  const openStatus = await prisma.taskStatusConfig.findFirst({
    where: { companyId: company.id, type: "OPEN" },
  });
  if (openStatus) {
    await prisma.task.updateMany({
      where: { companyId: company.id, status: config.key },
      data: { status: openStatus.key },
    });
  }

  await prisma.taskStatusConfig.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
