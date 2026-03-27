import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      roleLevels: { orderBy: { level: "asc" } },
      _count: { select: { users: true, tasks: true } },
    },
  });

  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: company });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, isActive, modules, roleLevels, logoUrl } = await req.json();

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
        ...(modules !== undefined && { modules }),
        ...(logoUrl !== undefined && {
          logoUrl: logoUrl === "" || logoUrl === null ? null : String(logoUrl).trim() || null,
        }),
      },
    });

    // Keep module toggles aligned with add-on gates for chat/recurring.
    if (modules !== undefined && Array.isArray(modules)) {
      await prisma.companyBilling.upsert({
        where: { companyId: id },
        update: {
          chatAddonEnabled: modules.includes("chat"),
          recurringAddonEnabled: modules.includes("recurring"),
        },
        create: {
          companyId: id,
          plan: "FREE",
          chatAddonEnabled: modules.includes("chat"),
          recurringAddonEnabled: modules.includes("recurring"),
        },
      });
    }

    if (roleLevels) {
      const existingIds = roleLevels.filter((r: { id?: string }) => r.id).map((r: { id: string }) => r.id);
      await prisma.roleLevel.deleteMany({
        where: { companyId: id, id: { notIn: existingIds } },
      });

      for (const rl of roleLevels) {
        if (rl.id) {
          await prisma.roleLevel.update({
            where: { id: rl.id },
            data: { name: rl.name, level: rl.level, color: rl.color },
          });
        } else {
          await prisma.roleLevel.create({
            data: { companyId: id, name: rl.name, level: rl.level, color: rl.color },
          });
        }
      }
    }

    return NextResponse.json({ success: true, data: company });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Company delete failed:", err);
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
