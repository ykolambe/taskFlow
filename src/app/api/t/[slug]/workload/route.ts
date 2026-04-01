import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchReportingLinksForCompany } from "@/lib/reportingLinks";
import { getSubtreeIds, getDirectReportIds, buildTeamWorkloadRows } from "@/lib/subtreeWorkload";

/**
 * GET /api/t/[slug]/workload?rootUserId=<id>
 * Workload for **direct reports only** of rootUserId (one org level). Drill into a row to see that person’s direct reports.
 * rootUserId must be within the viewer's subtree.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  const { slug } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rootUserId = req.nextUrl.searchParams.get("rootUserId");
  if (!rootUserId) {
    return NextResponse.json({ error: "rootUserId is required" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const [allUsers, lr] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: company.id, isActive: true, isTenantBootstrapAccount: false },
      include: { roleLevel: true },
    }),
    fetchReportingLinksForCompany(prisma, company.id),
  ]);

  const viewerSubtree = new Set(getSubtreeIds(lr, viewer.userId));
  if (!viewerSubtree.has(rootUserId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const directIds = getDirectReportIds(lr, rootUserId);

  const [statusConfigs, workloadTasks] = await Promise.all([
    prisma.taskStatusConfig.findMany({ where: { companyId: company.id } }),
    directIds.length > 0
      ? prisma.task.findMany({
          where: {
            companyId: company.id,
            assigneeId: { in: directIds },
            isArchived: false,
          },
          select: { assigneeId: true, status: true, dueDate: true, priority: true },
        })
      : Promise.resolve([]),
  ]);

  const doneKeys = new Set(statusConfigs.filter((s) => s.type === "DONE").map((s) => s.key));
  const rows = buildTeamWorkloadRows(
    directIds,
    workloadTasks,
    doneKeys,
    allUsers.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarUrl: u.avatarUrl,
      roleLevel: u.roleLevel,
    })),
    new Date()
  );

  return NextResponse.json({
    success: true,
    data: {
      rows,
      rootUserId,
    },
  });
}
