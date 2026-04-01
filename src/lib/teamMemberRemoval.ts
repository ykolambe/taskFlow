import type { PrismaClient } from "@prisma/client";
import { linksFromDb, isTargetUnderManager } from "@/lib/reportingLinks";

/** True if `targetId` is reachable below `requesterId` in the reporting graph (manager → subordinates). */
export async function isUserInRequestersSubtree(
  prisma: PrismaClient,
  companyId: string,
  requesterId: string,
  targetId: string
): Promise<boolean> {
  const links = await prisma.userReportingLink.findMany({
    where: { companyId },
    select: { subordinateId: true, managerId: true, sortOrder: true },
  });
  return isTargetUnderManager(linksFromDb(links), requesterId, targetId);
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
