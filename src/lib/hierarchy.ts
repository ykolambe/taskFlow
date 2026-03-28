import { prisma } from "@/lib/prisma";

async function getParentId(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { parentId: true },
  });
  return u?.parentId ?? null;
}

/** Walk up parentId chain: [directParent, ..., root] — same order as buildApproverChain in approvals. */
export async function getAncestorUserIds(userId: string): Promise<string[]> {
  const chain: string[] = [];
  let cursor = userId;
  for (let i = 0; i < 200; i++) {
    const parentId = await getParentId(cursor);
    if (!parentId) break;
    chain.push(parentId);
    cursor = parentId;
  }
  return chain;
}
