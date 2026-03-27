import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = NextResponse.json({ success: true });
  res.cookies.delete(`tenant_${slug}_token`);
  return res;
}
