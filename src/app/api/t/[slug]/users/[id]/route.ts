import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePassword } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { validateTeamMemberRemoval } from "@/lib/teamMemberRemoval";
import { getPrimaryManagerId, linksFromDb } from "@/lib/reportingLinks";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const target = await prisma.user.findUnique({
    where: { id },
    include: {
      roleLevel: true,
      reportingLinksAsManager: {
        include: { subordinate: { include: { roleLevel: true } } },
      },
    },
  });
  if (!target || target.companyId !== user.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: target });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const target = await prisma.user.findUnique({ where: { id }, include: { roleLevel: true } });
  if (!target || target.companyId !== currentUser.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!currentUser.isSuperAdmin && currentUser.userId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { firstName, lastName, isActive, roleLevelId, aiLeaderQaEnabled, isSuperAdmin } = body;

  const billing = currentUser.isSuperAdmin
    ? await prisma.companyBilling.findUnique({ where: { companyId: target.companyId } })
    : null;

  const nextData: Record<string, unknown> = {
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    ...(isActive !== undefined && currentUser.isSuperAdmin && { isActive }),
    ...(Object.prototype.hasOwnProperty.call(body, "roleLevelId") &&
      currentUser.isSuperAdmin && { roleLevelId: roleLevelId || null }),
    ...(aiLeaderQaEnabled !== undefined &&
      currentUser.isSuperAdmin && { aiLeaderQaEnabled: Boolean(aiLeaderQaEnabled) }),
    ...(isSuperAdmin !== undefined && currentUser.isSuperAdmin && { isSuperAdmin: Boolean(isSuperAdmin) }),
  };

  if (currentUser.isSuperAdmin && billing && body.chatAddonAccess !== undefined) {
    if (!billing.chatAddonEnabled) {
      return NextResponse.json({ error: "Company does not have the chat add-on." }, { status: 400 });
    }
    nextData.chatAddonAccess = Boolean(body.chatAddonAccess);
  }
  if (currentUser.isSuperAdmin && billing && body.recurringAddonAccess !== undefined) {
    if (!billing.recurringAddonEnabled) {
      return NextResponse.json({ error: "Company does not have the recurring add-on." }, { status: 400 });
    }
    nextData.recurringAddonAccess = Boolean(body.recurringAddonAccess);
  }
  if (currentUser.isSuperAdmin && billing && body.aiAddonAccess !== undefined) {
    if (!billing.aiAddonEnabled) {
      return NextResponse.json({ error: "Company does not have the AI add-on." }, { status: 400 });
    }
    nextData.aiAddonAccess = Boolean(body.aiAddonAccess);
  }
  if (currentUser.isSuperAdmin && billing && body.contentStudioAddonAccess !== undefined) {
    if (!billing.contentStudioAddonEnabled) {
      return NextResponse.json({ error: "Company does not have the Content Studio add-on." }, { status: 400 });
    }
    nextData.contentStudioAddonAccess = Boolean(body.contentStudioAddonAccess);
  }

  const shouldSyncManagers =
    currentUser.isSuperAdmin &&
    (Object.prototype.hasOwnProperty.call(body, "managerIds") ||
      Object.prototype.hasOwnProperty.call(body, "parentId"));

  let managerIdsToSync: string[] = [];
  if (shouldSyncManagers) {
    if (Array.isArray(body.managerIds)) {
      managerIdsToSync = body.managerIds.filter((x: unknown): x is string => typeof x === "string");
    } else if (typeof body.parentId === "string" && body.parentId) {
      managerIdsToSync = [body.parentId];
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data: nextData as Prisma.UserUpdateInput,
      include: { roleLevel: true },
    });

    if (shouldSyncManagers) {
      await tx.userReportingLink.deleteMany({ where: { subordinateId: id } });
      for (let i = 0; i < managerIdsToSync.length; i++) {
        await tx.userReportingLink.create({
          data: {
            companyId: target.companyId,
            subordinateId: id,
            managerId: managerIdsToSync[i],
            sortOrder: i,
          },
        });
      }
    }

    return u;
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!currentUser.isSuperAdmin && currentUser.level > 1) {
    return NextResponse.json({ error: "You don't have permission to remove users directly" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.companyId !== currentUser.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const removal = await validateTeamMemberRemoval(prisma, currentUser.companyId, currentUser.userId, currentUser.isSuperAdmin, {
    id: target.id,
    companyId: target.companyId,
    isTenantBootstrapAccount: target.isTenantBootstrapAccount,
    isSuperAdmin: target.isSuperAdmin,
    isActive: target.isActive,
  });
  if (!removal.ok) {
    return NextResponse.json({ error: removal.error }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const allLinks = await tx.userReportingLink.findMany({
      where: { companyId: currentUser.companyId },
      select: { subordinateId: true, managerId: true, sortOrder: true },
    });
    const lr = linksFromDb(allLinks);
    const primary = getPrimaryManagerId(lr, target.id);

    const asManager = await tx.userReportingLink.findMany({ where: { managerId: target.id } });
    for (const link of asManager) {
      if (primary && primary !== link.subordinateId) {
        const conflict = await tx.userReportingLink.findUnique({
          where: {
            subordinateId_managerId: {
              subordinateId: link.subordinateId,
              managerId: primary,
            },
          },
        });
        if (conflict) {
          await tx.userReportingLink.delete({ where: { id: link.id } });
        } else {
          await tx.userReportingLink.update({
            where: { id: link.id },
            data: { managerId: primary },
          });
        }
      } else {
        await tx.userReportingLink.delete({ where: { id: link.id } });
      }
    }

    await tx.userReportingLink.deleteMany({ where: { subordinateId: target.id } });
    await tx.user.update({ where: { id: target.id }, data: { isActive: false } });
  });

  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser || !currentUser.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.companyId !== currentUser.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const password = generatePassword(12);
  const target = await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });

  return NextResponse.json({
    success: true,
    password,
    email: target.email,
    username: target.username,
  });
}
