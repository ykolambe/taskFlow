import type { ChannelMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getGroupChannelForCompany(
  companyId: string,
  channelId: string
): Promise<{ id: string; type: string; companyId: string; name: string; createdById: string | null } | null> {
  const ch = await prisma.channel.findFirst({
    where: { id: channelId, companyId, type: "GROUP" },
    select: { id: true, type: true, companyId: true, name: true, createdById: true },
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

export async function countGroupAdmins(channelId: string): Promise<number> {
  return prisma.channelMember.count({
    where: { channelId, role: "ADMIN" },
  });
}
