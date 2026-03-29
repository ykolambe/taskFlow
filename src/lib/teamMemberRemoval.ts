import type { PrismaClient } from "@prisma/client";

/** True if `targetId` is a direct or indirect report of `requesterId` (walks parent chain from target upward). */
export async function isUserInRequestersSubtree(
  prisma: PrismaClient,
  companyId: string,
  requesterId: string,
  targetId: string
): Promise<boolean> {
  let curId: string | null = targetId;
  const seen = new Set<string>();
  while (curId) {
    if (seen.has(curId)) return false;
    seen.add(curId);
    const row: { parentId: string | null; companyId: string } | null = await prisma.user.findUnique({
      where: { id: curId },
      select: { parentId: true, companyId: true },
    });
    if (!row || row.companyId !== companyId) return false;
    if (row.parentId === requesterId) return true;
    curId = row.parentId;
  }
  return false;
}

export type RemovalTarget = {
  id: string;
  companyId: string;
  isTenantBootstrapAccount: boolean;
  isSuperAdmin: boolean;
  isActive: boolean;
};

/** Rules for proposing removal (approval request or direct delete when allowed). Super admin may remove anyone except self/bootstrap. */
export async function validateTeamMemberRemoval(
  prisma: PrismaClient,
  companyId: string,
  requesterId: string,
  requesterIsSuperAdmin: boolean,
  target: RemovalTarget
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (target.id === requesterId) {
    return { ok: false, error: "You cannot remove yourself" };
  }
  if (target.companyId !== companyId) {
    return { ok: false, error: "Not found" };
  }
  if (!target.isActive) {
    return { ok: false, error: "This member is already inactive" };
  }
  if (target.isTenantBootstrapAccount) {
    return { ok: false, error: "This account cannot be removed" };
  }
  if (target.isSuperAdmin && !requesterIsSuperAdmin) {
    return { ok: false, error: "Only a super admin can remove a super admin" };
  }
  if (requesterIsSuperAdmin) {
    return { ok: true };
  }
  const inSubtree = await isUserInRequestersSubtree(prisma, companyId, requesterId, target.id);
  if (!inSubtree) {
    return { ok: false, error: "You can only remove people in your reporting line" };
  }
  return { ok: true };
}
