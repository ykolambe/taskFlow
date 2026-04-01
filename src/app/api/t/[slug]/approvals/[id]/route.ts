import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePassword } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { getNextRequiredApprover } from "@/lib/approvalChain";
import { validateTeamMemberRemoval } from "@/lib/teamMemberRemoval";
import { canAddSeat } from "@/lib/planEntitlements";
import { getPrimaryManagerId, linksFromDb } from "@/lib/reportingLinks";

const USER_SELECT = {
  id: true, firstName: true, lastName: true, email: true, username: true,
  avatarUrl: true, roleLevelId: true, roleLevel: true, isSuperAdmin: true,
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { action, comment } = await req.json();
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Action must be 'approve' or 'reject'" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const approvalRequest = await prisma.approvalRequest.findUnique({
      where: { id },
      include: { approvals: true },
    });

    if (!approvalRequest || approvalRequest.companyId !== company.id) {
      return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
    }

    if (approvalRequest.status !== "PENDING") {
      return NextResponse.json({ error: "This request has already been processed" }, { status: 400 });
    }

    const chain = approvalRequest.approverChain as string[];
    const nextRequired = getNextRequiredApprover(chain, approvalRequest.approvals);

    // Permission: must be the next approver in chain (super admin included only when it is their turn).
    // Empty chain: no manager above requester — only the requester may approve.
    const allowedActor =
      chain.length === 0 ? approvalRequest.requesterId : nextRequired;
    if (allowedActor === null || currentUser.userId !== allowedActor) {
      if (approvalRequest.approvals.some((a) => a.approverId === currentUser.userId)) {
        return NextResponse.json({ error: "You have already acted on this request" }, { status: 400 });
      }
      return NextResponse.json({ error: "It is not your turn to approve this request" }, { status: 403 });
    }

    // Double-check not already acted
    if (approvalRequest.approvals.some((a) => a.approverId === currentUser.userId)) {
      return NextResponse.json({ error: "You have already acted on this request" }, { status: 400 });
    }

    // Record this approval/rejection
    await prisma.approval.create({
      data: {
        requestId: id,
        approverId: currentUser.userId,
        status: action === "approve" ? "APPROVED" : "REJECTED",
        comment: comment || null,
      },
    });

    if (action === "reject") {
      // Any rejection at any level immediately kills the request
      await prisma.approvalRequest.update({ where: { id }, data: { status: "REJECTED" } });
      const updated = await prisma.approvalRequest.findUnique({
        where: { id },
        include: { requester: { select: USER_SELECT }, approvals: { include: { approver: { select: USER_SELECT } } } },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // Check if all required approvals are now done.
    // Reload approvals to include the one we just created.
    const updatedApprovals = await prisma.approval.findMany({ where: { requestId: id } });
    const remainingApprover = getNextRequiredApprover(chain, updatedApprovals);

    if (remainingApprover !== null) {
      // More approvers in the chain — stay PENDING, pass to next person
      const updated = await prisma.approvalRequest.findUnique({
        where: { id },
        include: { requester: { select: USER_SELECT }, approvals: { include: { approver: { select: USER_SELECT } } } },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    const rawPayload = approvalRequest.newUserData as { kind?: string; targetUserId?: string };

    // All approvers have approved — remove member
    if (rawPayload.kind === "REMOVE") {
      const targetUserId = rawPayload.targetUserId as string;
      const target = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!target || target.companyId !== company.id) {
        return NextResponse.json({ error: "User no longer exists in this company" }, { status: 409 });
      }

      const requesterRow = await prisma.user.findUnique({
        where: { id: approvalRequest.requesterId },
        select: { isSuperAdmin: true },
      });
      const removal = await validateTeamMemberRemoval(
        prisma,
        company.id,
        approvalRequest.requesterId,
        Boolean(requesterRow?.isSuperAdmin),
        {
          id: target.id,
          companyId: target.companyId,
          isTenantBootstrapAccount: target.isTenantBootstrapAccount,
          isSuperAdmin: target.isSuperAdmin,
          isActive: target.isActive,
        }
      );
      if (!removal.ok) {
        return NextResponse.json({ error: removal.error }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        const allLinks = await tx.userReportingLink.findMany({
          where: { companyId: company.id },
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
        await tx.user.update({
          where: { id: target.id },
          data: { isActive: false },
        });
        await tx.approvalRequest.update({ where: { id }, data: { status: "APPROVED" } });
      });

      const updated = await prisma.approvalRequest.findUnique({
        where: { id },
        include: { requester: { select: USER_SELECT }, approvals: { include: { approver: { select: USER_SELECT } } } },
      });

      return NextResponse.json({ success: true, data: updated, removedUserId: target.id });
    }

    // All approvers have approved — create the user (add member)
    const newUserData = approvalRequest.newUserData as {
      firstName: string;
      lastName: string;
      email: string;
      username?: string;
      roleLevelId: string;
      parentId?: string;
      managerIds?: string[];
    };

    const password = generatePassword(12);
    const username =
      newUserData.username ||
      `${newUserData.firstName.toLowerCase().replace(/\s/g, "")}${Math.floor(Math.random() * 1000)}`;

    const existingEmail = await prisma.user.findFirst({
      where: { companyId: company.id, email: newUserData.email.toLowerCase() },
      select: { id: true },
    });
    if (existingEmail) {
      return NextResponse.json({ error: "User with this email already exists in company" }, { status: 409 });
    }

    const seatCheck = await canAddSeat(company.id);
    if (!seatCheck.ok) {
      return NextResponse.json({ error: seatCheck.reason }, { status: 403 });
    }

    const managerIds: string[] =
      Array.isArray(newUserData.managerIds) && newUserData.managerIds.length > 0
        ? newUserData.managerIds.filter((x): x is string => typeof x === "string")
        : newUserData.parentId
          ? [newUserData.parentId]
          : [];

    await prisma.$transaction(async (tx) => {
      const nu = await tx.user.create({
        data: {
          companyId: company.id,
          roleLevelId: newUserData.roleLevelId,
          email: newUserData.email.toLowerCase(),
          username,
          passwordHash: await bcrypt.hash(password, 12),
          firstName: newUserData.firstName,
          lastName: newUserData.lastName,
        },
      });
      for (let i = 0; i < managerIds.length; i++) {
        await tx.userReportingLink.create({
          data: {
            companyId: company.id,
            subordinateId: nu.id,
            managerId: managerIds[i],
            sortOrder: i,
          },
        });
      }
      await tx.approvalRequest.update({ where: { id }, data: { status: "APPROVED" } });
    });

    const updated = await prisma.approvalRequest.findUnique({
      where: { id },
      include: { requester: { select: USER_SELECT }, approvals: { include: { approver: { select: USER_SELECT } } } },
    });

    // Return credentials so the final approver can share them
    return NextResponse.json({
      success: true,
      data: updated,
      credentials: { username, password },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to process approval" }, { status: 500 });
  }
}
