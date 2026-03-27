import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isExecutiveDashboardUser } from "@/lib/utils";
import { getSubtreeIds } from "@/lib/subtreeWorkload";
import { buildExecutiveBriefPrompt, executiveBriefJsonSchema } from "@/lib/ai/executiveBriefPrompt";
import { generateGeminiJson } from "@/lib/ai/gemini";
import { isCompanyAiEnabled } from "@/lib/ai/entitlement";
import type { ExecutiveBrief, ExecutiveBriefContext, ExecutiveBriefResponse } from "@/lib/ai/types";

const briefSchema: z.ZodType<ExecutiveBrief> = z.object({
  summary: z.string().min(1),
  whatChanged: z.array(z.string()).max(6),
  topRisks: z.array(
    z.object({
      title: z.string().min(1),
      why: z.string().min(1),
      severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
    })
  ),
  decisionsNeeded: z.array(
    z.object({
      decision: z.string().min(1),
      impact: z.string().min(1),
      recommendedOwner: z.string().min(1),
    })
  ),
  next7Days: z.array(z.string()),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  sourceNote: z.string().min(1),
});

const globalRate = globalThis as unknown as {
  __execBriefRate?: Map<string, number>;
};
const rateMap = globalRate.__execBriefRate ?? new Map<string, number>();
globalRate.__execBriefRate = rateMap;

function rateLimitKey(companyId: string, userId: string): string {
  return `${companyId}:${userId}`;
}

function checkRateLimit(companyId: string, userId: string): boolean {
  const key = rateLimitKey(companyId, userId);
  const now = Date.now();
  const last = rateMap.get(key) ?? 0;
  if (now - last < 15_000) return false;
  rateMap.set(key, now);
  return true;
}

function fallbackBrief(ctx: ExecutiveBriefContext): ExecutiveBrief {
  const topHotspots = ctx.hotspots.slice(0, 2);
  const hotspotLine =
    topHotspots.length > 0
      ? topHotspots
          .map((h) => `${h.name} (${h.openTasks} open, ${h.overdueTasks} overdue)`)
          .join(", ")
      : "No major individual hotspots detected";

  return {
    summary: `Team has ${ctx.metrics.openTasks} open tasks (${ctx.metrics.overdueTasks} overdue, ${ctx.metrics.highPriorityOpen} high/urgent). Pending approvals: ${ctx.metrics.pendingApprovals}.`,
    whatChanged: [
      `${ctx.metrics.newTasksLast24h} tasks were created in the last 24h`,
      `${ctx.metrics.completedLast24h} tasks were completed in the last 24h`,
      `${ctx.metrics.remindersDueNext7Days} reminders are due in the next 7 days`,
    ],
    topRisks: [
      {
        title: "Execution slippage risk",
        why: `${ctx.metrics.overdueTasks} overdue tasks remain open`,
        severity: ctx.metrics.overdueTasks > 10 ? "HIGH" : ctx.metrics.overdueTasks > 4 ? "MEDIUM" : "LOW",
      },
      {
        title: "Workload concentration",
        why: hotspotLine,
        severity: topHotspots.some((h) => h.overdueTasks >= 3) ? "HIGH" : "MEDIUM",
      },
    ],
    decisionsNeeded: [
      {
        decision: "Confirm escalation owners for top overdue items",
        impact: "Reduces risk of further delivery slippage",
        recommendedOwner: `${ctx.leader.firstName} ${ctx.leader.lastName}`,
      },
      {
        decision: "Rebalance workload across direct reports",
        impact: "Improves throughput and lowers single-point bottlenecks",
        recommendedOwner: "Department head",
      },
    ],
    next7Days: [
      "Run a focused review on overdue high-priority tasks",
      "Close pending approvals older than 48 hours",
      "Validate that each hotspot owner has a recovery plan",
    ],
    confidence: "MEDIUM",
    sourceNote: "Generated from deterministic internal metrics because AI output was unavailable.",
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const { slug } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isExecutiveDashboardUser(viewer)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (!(await isCompanyAiEnabled(company.id))) {
    return NextResponse.json({ error: "AI add-on is not enabled for this company." }, { status: 403 });
  }

  if (!checkRateLimit(company.id, viewer.userId)) {
    return NextResponse.json({ error: "Too many requests. Please wait a few seconds." }, { status: 429 });
  }

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const next7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: { companyId: company.id, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentId: true,
      roleLevel: { select: { name: true, level: true } },
    },
  });

  const refs = users.map((u) => ({ id: u.id, parentId: u.parentId }));
  const visibleIds = getSubtreeIds(refs, viewer.userId);
  const directReportIds = users.filter((u) => u.parentId === viewer.userId).map((u) => u.id);

  const statusConfigs = await prisma.taskStatusConfig.findMany({
    where: { companyId: company.id },
    select: { key: true, type: true },
  });
  const doneKeys = new Set(statusConfigs.filter((s) => s.type === "DONE").map((s) => s.key));

  const [
    openTasksRaw,
    approvalsPending,
    approvalRows,
    remindersDueNext7Days,
    remindersOverdue,
    newTasksLast24h,
    completedLast24h,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        companyId: company.id,
        assigneeId: { in: visibleIds },
        isArchived: false,
      },
      select: {
        assigneeId: true,
        priority: true,
        dueDate: true,
        status: true,
      },
    }),
    prisma.approvalRequest.count({ where: { companyId: company.id, status: "PENDING" } }),
    prisma.approvalRequest.findMany({
      where: { companyId: company.id, status: "PENDING" },
      select: { approverChain: true, approvals: { select: { approverId: true, status: true } } },
    }),
    prisma.userReminder.count({
      where: {
        companyId: company.id,
        userId: viewer.userId,
        isDone: false,
        remindAt: { gte: now, lte: next7d },
      },
    }),
    prisma.userReminder.count({
      where: { companyId: company.id, userId: viewer.userId, isDone: false, remindAt: { lt: now } },
    }),
    prisma.task.count({
      where: { companyId: company.id, assigneeId: { in: visibleIds }, createdAt: { gte: since24h } },
    }),
    prisma.task.count({
      where: { companyId: company.id, assigneeId: { in: visibleIds }, completedAt: { gte: since24h } },
    }),
  ]);

  const openTasks = openTasksRaw.filter((t) => !doneKeys.has(t.status) && t.status !== "COMPLETED");
  const overdueTasks = openTasks.filter((t) => t.dueDate && t.dueDate < now).length;
  const highPriorityOpen = openTasks.filter((t) => t.priority === "HIGH" || t.priority === "URGENT").length;

  const byAssignee = new Map<string, { open: number; overdue: number; urgent: number }>();
  for (const task of openTasks) {
    const c = byAssignee.get(task.assigneeId) ?? { open: 0, overdue: 0, urgent: 0 };
    c.open += 1;
    if (task.dueDate && task.dueDate < now) c.overdue += 1;
    if (task.priority === "HIGH" || task.priority === "URGENT") c.urgent += 1;
    byAssignee.set(task.assigneeId, c);
  }

  const hotspotCandidates = users
    .filter((u) => visibleIds.includes(u.id) && u.id !== viewer.userId)
    .map((u) => {
      const counts = byAssignee.get(u.id) ?? { open: 0, overdue: 0, urgent: 0 };
      return {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        role: u.roleLevel?.name ?? "Team member",
        openTasks: counts.open,
        overdueTasks: counts.overdue,
        urgentTasks: counts.urgent,
      };
    })
    .sort((a, b) => b.openTasks - a.openTasks || b.overdueTasks - a.overdueTasks)
    .slice(0, 4);

  const priorityMix = (["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((priority) => ({
    priority,
    count: openTasks.filter((t) => t.priority === priority).length,
  }));

  const pendingApprovalsForViewer = viewer.isSuperAdmin
    ? approvalsPending
    : approvalRows.filter((row) => {
        const chain = row.approverChain as string[];
        const approvedIds = new Set(
          row.approvals.filter((x) => x.status === "APPROVED").map((x) => x.approverId)
        );
        const next = chain.find((uid) => !approvedIds.has(uid));
        return next === viewer.userId;
      }).length;

  const context: ExecutiveBriefContext = {
    companyName: company.name,
    generatedAt: now.toISOString(),
    leader: {
      userId: viewer.userId,
      firstName: viewer.firstName,
      lastName: viewer.lastName,
      level: viewer.level,
      isSuperAdmin: viewer.isSuperAdmin,
    },
    metrics: {
      visibleTeamSize: visibleIds.length,
      directReports: directReportIds.length,
      openTasks: openTasks.length,
      overdueTasks,
      highPriorityOpen,
      pendingApprovals: pendingApprovalsForViewer,
      remindersDueNext7Days,
      remindersOverdue,
      newTasksLast24h,
      completedLast24h,
    },
    priorityMix,
    hotspots: hotspotCandidates,
  };

  let brief: ExecutiveBrief;
  let source: "ai" | "fallback" = "ai";

  try {
    const prompt = buildExecutiveBriefPrompt(context);
    const generated = await generateGeminiJson<ExecutiveBrief>({
      prompt,
      responseSchema: executiveBriefJsonSchema as unknown as Record<string, unknown>,
      timeoutMs: 12000,
      retries: 1,
      companyId: company.id,
      endpointTag: "executive-brief",
    });
    brief = briefSchema.parse(generated);
  } catch (error) {
    console.error("Executive brief AI failed:", error);
    source = "fallback";
    brief = fallbackBrief(context);
  }

  const response: ExecutiveBriefResponse = {
    brief,
    source,
    generatedAt: now.toISOString(),
  };

  return NextResponse.json({ success: true, data: response });
}
