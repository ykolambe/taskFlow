import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextRequiredApprover } from "@/lib/approvalChain";
import { validateTeamMemberRemoval } from "@/lib/teamMemberRemoval";
import { getPrimaryManagerId, linksFromDb } from "@/lib/reportingLinks";

export { getNextRequiredApprover };

const REQUESTER_SELECT = {
  id: true, firstName: true, lastName: true, email: true, username: true,
  avatarUrl: true, roleLevelId: true, roleLevel: true, isSuperAdmin: true,
};

/** Walk up primary-manager chain: [directParent, ..., root]. Skips tenant bootstrap accounts. */
async function buildApproverChain(userId: string, companyId: string): Promise<string[]> {
  const links = await prisma.userReportingLink.findMany({
    where: { companyId },
    select: { subordinateId: true, managerId: true, sortOrder: true },
  });
  const lr = linksFromDb(links);
  const chain: string[] = [];
  let currentId = userId;
  for (let i = 0; i < 200; i++) {
    const primary = getPrimaryManagerId(lr, currentId);
    if (!primary) break;
    const parentRow = await prisma.user.findUnique({
      where: { id: primary },
      select: { isTenantBootstrapAccount: true },
    });
    if (!parentRow) break;
    if (!parentRow.isTenantBootstrapAccount) {
      chain.push(primary);
    }
    currentId = primary;
  }
  return chain;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Pending requests in the company: whose turn is it (including empty chain → requester)
  const allPending = await prisma.approvalRequest.findMany({
    where: { companyId: company.id, status: "PENDING" },
    select: {
      id: true,
      requesterId: true,
      approverChain: true,
      approvals: { select: { approverId: true, status: true } },
    },
  });

  const myTurnIds = allPending
    .filter((req) => {
      const chain = req.approverChain as string[];
      const next = getNextRequiredApprover(chain, req.approvals);
      const turn = chain.length === 0 ? req.requesterId : next;
      return turn === user.userId;
    })
    .map((r) => r.id);

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      companyId: company.id,
      OR: [
        { requesterId: user.userId },         // requests I submitted
        { id: { in: myTurnIds } },            // requests awaiting my action
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: REQUESTER_SELECT },
      approvals: { include: { approver: { select: REQUESTER_SELECT } } },
    },
  });

  return NextResponse.json({ success: true, data: approvals });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { newUserData } = await req.json();

    const company = await prisma.company.findUnique({
      where: { slug },
      include: { roleLevels: { orderBy: { level: "asc" } } },
    });
    if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ─── Remove member (same approval chain as add) ───────────────────────
    if (newUserData?.kind === "REMOVE") {
      const targetUserId = newUserData.targetUserId as string | undefined;
      if (!targetUserId) {
        return NextResponse.json({ error: "Missing target user" }, { status: 400 });
      }

      const target = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!target || target.companyId !== company.id) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const removal = await validateTeamMemberRemoval(prisma, company.id, user.userId, user.isSuperAdmin, {
        id: target.id,
        companyId: target.companyId,
        isTenantBootstrapAccount: target.isTenantBootstrapAccount,
        isSuperAdmin: target.isSuperAdmin,
        isActive: target.isActive,
      });
      if (!removal.ok) {
        return NextResponse.json({ error: removal.error }, { status: 400 });
      }

      const pending = await prisma.approvalRequest.findMany({
        where: { companyId: company.id, status: "PENDING" },
        select: { newUserData: true },
      });
      const dup = pending.some((p) => {
        const d = p.newUserData as { kind?: string; targetUserId?: string };
        return d?.kind === "REMOVE" && d?.targetUserId === targetUserId;
      });
      if (dup) {
        return NextResponse.json(
          { error: "A pending removal request already exists for this member" },
          { status: 409 }
        );
      }

      const roleLevelName = target.roleLevelId
        ? company.roleLevels.find((r) => r.id === target.roleLevelId)?.name ?? "—"
        : "—";

      const approverChain = await buildApproverChain(user.userId, company.id);

      const request = await prisma.approvalRequest.create({
        data: {
          companyId: company.id,
          requesterId: user.userId,
          newUserData: {
            kind: "REMOVE" as const,
            targetUserId,
            firstName: target.firstName,
            lastName: target.lastName,
            email: target.email,
            roleLevelName,
          },
          approverChain,
          status: "PENDING",
        },
        include: {
          requester: { select: REQUESTER_SELECT },
          approvals: true,
        },
      });

      return NextResponse.json({ success: true, data: request });
    }

    // ─── Add member (existing) ───────────────────────────────────────────
    if (!newUserData?.firstName || !newUserData?.email || !newUserData?.roleLevelId) {
      return NextResponse.json({ error: "Missing required new user data" }, { status: 400 });
    }

    const roleLevel = company.roleLevels.find((r) => r.id === newUserData.roleLevelId);
    if (!roleLevel) return NextResponse.json({ error: "Invalid role level" }, { status: 400 });

    const approverChain = await buildApproverChain(user.userId, company.id);

    const request = await prisma.approvalRequest.create({
      data: {
        companyId: company.id,
        requesterId: user.userId,
        newUserData: {
          ...newUserData,
          kind: "ADD" as const,
          roleLevelName: roleLevel.name,
          roleLevelLevel: roleLevel.level,
        },
        approverChain,
        status: "PENDING",
      },
      include: {
        requester: { select: REQUESTER_SELECT },
        approvals: true,
      },
    });

    return NextResponse.json({ success: true, data: request });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create approval request" }, { status: 500 });
  }
}
