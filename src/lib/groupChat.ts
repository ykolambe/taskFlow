import type { ChannelMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getGroupChannelForCompany(
  companyId: string,
  channelId: string
): Promise<{
  id: string;
  type: string;
  companyId: string;
  name: string;
  createdById: string | null;
  avatarUrl: string | null;
} | null> {
  const ch = await prisma.channel.findFirst({
    where: { id: channelId, companyId, type: "GROUP" },
    select: { id: true, type: true, companyId: true, name: true, createdById: true, avatarUrl: true },
  });
  return ch;
}

export async function getMembership(
  channelId: string,
  userId: string
): Promise<{ id: string; role: ChannelMemberRole } | null> {
  return prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { id: true, role: true },
  });
}

export async function isGroupAdmin(channelId: string, userId: string): Promise<boolean> {
  const m = await getMembership(channelId, userId);
  return m?.role === "ADMIN";
}

/**
 * Who may rename the group, add/remove members, and change roles: channel ADMIN, group creator,
 * or tenant super admin (must be a member of the group).
 */
export function canManageGroupSync(params: {
  membershipRole: "MEMBER" | "ADMIN" | null;
  viewerUserId: string;
  viewerIsSuperAdmin: boolean;
  channelCreatedById: string | null;
}): boolean {
  const { membershipRole, viewerUserId, viewerIsSuperAdmin, channelCreatedById } = params;
  if (!membershipRole) return false;
  if (membershipRole === "ADMIN") return true;
  if (channelCreatedById && channelCreatedById === viewerUserId) return true;
  if (viewerIsSuperAdmin) return true;
  return false;
}

export async function canManageGroup(
  channelId: string,
  viewer: { userId: string; isSuperAdmin: boolean },
  channel: { createdById: string | null }
): Promise<boolean> {
  const m = await getMembership(channelId, viewer.userId);
  if (!m) return false;
  return canManageGroupSync({
    membershipRole: m.role,
    viewerUserId: viewer.userId,
    viewerIsSuperAdmin: viewer.isSuperAdmin,
    channelCreatedById: channel.createdById,
  });
}

export async function countGroupAdmins(channelId: string): Promise<number> {
  return prisma.channelMember.count({
    where: { channelId, role: "ADMIN" },
  });
}
