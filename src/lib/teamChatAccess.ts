import type { ChannelType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ChannelForAccess = {
  id: string;
  companyId: string;
  type: ChannelType;
  dmUserLowId: string | null;
  dmUserHighId: string | null;
};

/** Team chat UI only exposes DMs and groups; broadcast channel types are not accessible via the chat API. */
export async function canAccessTeamChatChannel(params: {
  channel: ChannelForAccess;
  viewerUserId: string;
  companyId: string;
}): Promise<boolean> {
  const { channel, viewerUserId, companyId } = params;
  if (channel.companyId !== companyId) return false;

  if (channel.type === "DM") {
    return channel.dmUserLowId === viewerUserId || channel.dmUserHighId === viewerUserId;
  }

  if (channel.type === "GROUP") {
    const m = await prisma.channelMember.findFirst({
      where: { channelId: channel.id, userId: viewerUserId },
      select: { id: true },
    });
    return !!m;
  }

  return false;
}
