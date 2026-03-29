import { prisma } from "@/lib/prisma";
import { getNextRequiredApprover } from "@/lib/approvalChain";

/** Pending team-member approvals where it is this user's turn to act (sequential chain; empty chain → requester). */
export async function countPendingApprovalsForUser(companyId: string, userId: string): Promise<number> {
  const allPending = await prisma.approvalRequest.findMany({
    where: { companyId, status: "PENDING" },
    select: {
      requesterId: true,
      approverChain: true,
      approvals: { select: { approverId: true, status: true } },
    },
  });
  return allPending.filter((req) => {
    const chain = req.approverChain as string[];
    const next = getNextRequiredApprover(chain, req.approvals);
    const turn = chain.length === 0 ? req.requesterId : next;
    return turn === userId;
  }).length;
}
