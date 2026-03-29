import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isModuleEnabledForCompany } from "@/lib/tenantRuntime";

type Params = { params: Promise<{ slug: string }> | { slug: string } };

function sortDmPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isModuleEnabledForCompany(company.id, "chat"))) {
    return NextResponse.json({ error: "Chat module is disabled for this tenant." }, { status: 403 });
  }

  let body: { peerUserId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const peerUserId = (body.peerUserId ?? "").trim();
  if (!peerUserId) {
    return NextResponse.json({ error: "peerUserId is required" }, { status: 400 });
  }
  if (peerUserId === viewer.userId) {
    return NextResponse.json({ error: "You cannot start a chat with yourself" }, { status: 400 });
  }

  const peer = await prisma.user.findFirst({
    where: {
      id: peerUserId,
      companyId: company.id,
      isActive: true,
      isTenantBootstrapAccount: false,
    },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  if (!peer) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [low, high] = sortDmPair(viewer.userId, peer.id);

  const existing = await prisma.channel.findFirst({
    where: {
      companyId: company.id,
      type: "DM",
      dmUserLowId: low,
      dmUserHighId: high,
    },
  });
  if (existing) {
    return NextResponse.json({ success: true, data: existing, created: false });
  }

  const slugPart = `dm-${low}-${high}`;
  const name = `${peer.firstName} ${peer.lastName}`;

  const channel = await prisma.channel.create({
    data: {
      companyId: company.id,
      slug: slugPart,
      name,
      type: "DM",
      dmUserLowId: low,
      dmUserHighId: high,
    },
  });

  return NextResponse.json({ success: true, data: channel, created: true }, { status: 201 });
}
