import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextRequiredApprover } from "@/lib/approvalChain";

export { getNextRequiredApprover };

const REQUESTER_SELECT = {
  id: true, firstName: true, lastName: true, email: true, username: true,
  avatarUrl: true, roleLevelId: true, roleLevel: true, isSuperAdmin: true,
};

/** Walk up parentId chain and return ordered array [directParent, ..., root]. Skips tenant bootstrap accounts. */
async function buildApproverChain(userId: string): Promise<string[]> {
  const chain: string[] = [];
  let currentId: string | null = userId;

  while (currentId) {
    const record: { parentId: string | null } | null = await prisma.user.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    if (!record?.parentId) break;

    const parentRow = await prisma.user.findUnique({
      where: { id: record.parentId },
      select: { isTenantBootstrapAccount: true },
    });
    if (!parentRow) break;

    if (!parentRow.isTenantBootstrapAccount) {
      chain.push(record.parentId);
    }
    currentId = record.parentId;
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

    if (!newUserData?.firstName || !newUserData?.email || !newUserData?.roleLevelId) {
      return NextResponse.json({ error: "Missing required new user data" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { slug },
      include: { roleLevels: { orderBy: { level: "asc" } } },
    });
    if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const roleLevel = company.roleLevels.find((r) => r.id === newUserData.roleLevelId);
    if (!roleLevel) return NextResponse.json({ error: "Invalid role level" }, { status: 400 });

    // Build the approver chain from the requester's parent hierarchy
    const approverChain = await buildApproverChain(user.userId);

    const request = await prisma.approvalRequest.create({
      data: {
        companyId: company.id,
        requesterId: user.userId,
        newUserData: {
          ...newUserData,
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
