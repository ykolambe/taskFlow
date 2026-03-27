import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePassword } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { getNextRequiredApprover } from "../route";

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

    // Permission check: must be the next required approver OR super admin
    if (!currentUser.isSuperAdmin && currentUser.userId !== nextRequired) {
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
    const approvedIds = new Set(
      updatedApprovals
        .filter((a) => a.status === "APPROVED")
        .map((a) => a.approverId)
    );

    const chainUsers = await prisma.user.findMany({
      where: { id: { in: chain }, companyId: company.id },
      select: { id: true, isSuperAdmin: true, roleLevel: { select: { level: true } } },
    });
    const chainUserById = new Map(chainUsers.map((u) => [u.id, u]));

    // Business rule:
    // If top-level employee (highest rank non-superadmin in chain) approved,
    // super-admin-only steps are no longer required.
    const topEmployeeLevel = chainUsers
      .filter((u) => !u.isSuperAdmin && u.roleLevel?.level !== null && u.roleLevel?.level !== undefined)
      .reduce<number | null>((min, u) => {
        const lvl = u.roleLevel!.level;
        return min === null ? lvl : Math.min(min, lvl);
      }, null);

    const topEmployeeApproved =
      topEmployeeLevel !== null &&
      chainUsers.some((u) => !u.isSuperAdmin && u.roleLevel?.level === topEmployeeLevel && approvedIds.has(u.id));

    const remainingApprover = chain.find((uid) => {
      if (approvedIds.has(uid)) return false;
      if (topEmployeeApproved && chainUserById.get(uid)?.isSuperAdmin) return false;
      return true;
    }) ?? null;
    const approvedBySuperAdmin = currentUser.isSuperAdmin;

    if (!approvedBySuperAdmin && remainingApprover !== null) {
      // More approvers in the chain — stay PENDING, pass to next person
      const updated = await prisma.approvalRequest.findUnique({
        where: { id },
        include: { requester: { select: USER_SELECT }, approvals: { include: { approver: { select: USER_SELECT } } } },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // All approvers have approved — create the user
    const newUserData = approvalRequest.newUserData as {
      firstName: string;
      lastName: string;
      email: string;
      username?: string;
      roleLevelId: string;
      parentId?: string;
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

    await prisma.user.create({
      data: {
        companyId: company.id,
        roleLevelId: newUserData.roleLevelId,
        parentId: newUserData.parentId || null,
        email: newUserData.email.toLowerCase(),
        username,
        passwordHash: await bcrypt.hash(password, 12),
        firstName: newUserData.firstName,
        lastName: newUserData.lastName,
      },
    });

    await prisma.approvalRequest.update({ where: { id }, data: { status: "APPROVED" } });

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
