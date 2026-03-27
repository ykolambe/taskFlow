import { NextRequest, NextResponse } from "next/server";
import { getPlatformUser } from "@/lib/auth";
import { processPendingProvisioningJobs } from "@/lib/tenantProvisioning";

export async function POST(req: NextRequest) {
  const user = await getPlatformUser();
  const token = req.headers.get("x-provisioning-token");
  const allowedByToken = Boolean(process.env.PROVISIONING_RUN_TOKEN) && token === process.env.PROVISIONING_RUN_TOKEN;
  if (!user && !allowedByToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Number(body?.limit ?? 5);
  const results = await processPendingProvisioningJobs(limit);
  return NextResponse.json({ success: true, processed: results.length, results });
}

