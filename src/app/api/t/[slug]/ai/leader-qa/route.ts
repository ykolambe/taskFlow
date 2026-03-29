import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSubtreeIds } from "@/lib/subtreeWorkload";
import { isCompanyAiEnabled } from "@/lib/ai/entitlement";
import { buildLeaderQaPrompt, leaderQaResponseSchema } from "@/lib/ai/leaderQaPrompt";
import { generateGeminiJson } from "@/lib/ai/gemini";
import type { LeaderQaAnswer, LeaderQaMetric, LeaderQaResponse } from "@/lib/ai/types";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type BulkDraftTask = {
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  priority: Priority;
  dueDate: string | null;
};

type SkippedEntry = {
  requested: string;
  reason: "ambiguous" | "not_found" | "no_permission" | "invalid_selector" | "no_permission_on_confirm";
  candidates?: Array<{ id: string; name: string; email: string }>;
};

type BulkPlan = {
  planId: string;
  companyId: string;
  creatorUserId: string;
  createdAt: number;
  specHash: string;
  requiresSecondConfirmation: boolean;
  drafts: BulkDraftTask[];
};

function parseDueDateInput(input: string): Date {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, monthIndex, day);
  }
  return new Date(input);
}

function formatDateForReminderNote(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const reqSchema = z.object({
  action: z.enum(["ask", "confirm_bulk_create"]).optional(),
  question: z.string().min(4).max(500).optional(),
  planId: z.string().optional(),
  specHash: z.string().optional(),
  secondConfirm: z.boolean().optional(),
});

const answerSchema: z.ZodType<LeaderQaAnswer> = z.object({
  answer: z.string().min(1),
  topDrivers: z.array(z.string()),
  actions: z.array(z.string()),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  citations: z.array(z.string()),
});

const taskExtractSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    description: { type: "STRING" },
    assigneeName: { type: "STRING" },
    priority: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
    dueDate: { type: "STRING" },
    acceptanceCriteria: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["title", "assigneeName", "priority"],
} as const;

const taskDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeName: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
});

const bulkExtractSchema = {
  type: "OBJECT",
  properties: {
    titleTemplate: { type: "STRING" },
    description: { type: "STRING" },
    targetScope: { type: "STRING", enum: ["DIRECT_REPORTS", "TEAM_ALL", "ROLE", "NAMES"] },
    roleName: { type: "STRING" },
    explicitNames: { type: "ARRAY", items: { type: "STRING" } },
    priority: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
    dueDate: { type: "STRING" },
    acceptanceCriteria: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["titleTemplate", "targetScope", "priority"],
} as const;

const bulkSpecSchema = z.object({
  titleTemplate: z.string().min(1),
  description: z.string().optional(),
  targetScope: z.enum(["DIRECT_REPORTS", "TEAM_ALL", "ROLE", "NAMES"]),
  roleName: z.string().optional(),
  explicitNames: z.array(z.string()).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
});

const globalRate = globalThis as unknown as {
  __leaderQaRate?: Map<string, number>;
  __leaderQaPlans?: Map<string, BulkPlan>;
};
const rateMap = globalRate.__leaderQaRate ?? new Map<string, number>();
const planMap = globalRate.__leaderQaPlans ?? new Map<string, BulkPlan>();
globalRate.__leaderQaRate = rateMap;
globalRate.__leaderQaPlans = planMap;

function checkRateLimit(companyId: string, userId: string): boolean {
  const key = `${companyId}:${userId}`;
  const now = Date.now();
  const last = rateMap.get(key) ?? 0;
  if (now - last < 8_000) return false;
  rateMap.set(key, now);
  return true;
}

function cleanupPlans(): void {
  const now = Date.now();
  for (const [k, v] of planMap.entries()) {
    if (now - v.createdAt > 15 * 60 * 1000) planMap.delete(k);
  }
}

function hashDrafts(drafts: BulkDraftTask[]): string {
  return createHash("sha256").update(JSON.stringify(drafts)).digest("hex");
}

function fallbackAnswer(question: string, metrics: LeaderQaMetric[]): LeaderQaAnswer {
  const overdue = Number(metrics.find((m) => m.key === "M2")?.value ?? 0);
  const highUrgent = Number(metrics.find((m) => m.key === "M3")?.value ?? 0);
  const approvals = Number(metrics.find((m) => m.key === "M5")?.value ?? 0);
  const active = Number(metrics.find((m) => m.key === "M1")?.value ?? 0);
  return {
    answer: `Based on current metrics for "${question}", slippage is mainly driven by overdue work (${overdue}) and priority pressure (${highUrgent} high/urgent open tasks) across ${active} active tasks.`,
    topDrivers: [
      `Overdue tasks remain high (${overdue}) [M2]`,
      `High/urgent workload is elevated (${highUrgent}) [M3]`,
      `Pending approvals can delay execution (${approvals}) [M5]`,
    ],
    actions: [
      "Escalate top 5 overdue tasks with named owners this week.",
      "Rebalance high-priority assignments across available direct reports.",
      "Clear pending approvals older than 48 hours.",
    ],
    confidence: "MEDIUM",
    citations: ["M1", "M2", "M3", "M5"],
  };
}

function maybeTaskIntent(question: string): boolean {
  return /(create|assign|new task|todo|to do|follow up|delegate)/i.test(question);
}

function maybeBulkIntent(question: string): boolean {
  return /(all|everyone|each|every|across|for all|team|direct reports|entire team|list|people|members)/i.test(question);
}

function pickNameMatches(
  q: string,
  visibleUsers: Array<{ id: string; firstName: string; lastName: string; email: string; username: string }>
): Array<{ id: string; firstName: string; lastName: string; email: string; username: string }> {
  const query = q.toLowerCase().trim();
  const exact = visibleUsers.filter((u) => {
    const full = `${u.firstName} ${u.lastName}`.toLowerCase();
    return full === query || u.email.toLowerCase() === query || u.username.toLowerCase() === query;
  });
  if (exact.length > 0) return exact;
  return visibleUsers.filter((u) => {
    const full = `${u.firstName} ${u.lastName}`.toLowerCase();
    return full.includes(query) || u.email.toLowerCase().includes(query) || u.username.toLowerCase().includes(query);
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const { slug } = await params;
  const viewer = await getTenantUser(slug);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  cleanupPlans();

  const parsedReq = reqSchema.safeParse(await req.json().catch(() => null));
  if (!parsedReq.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const action = parsedReq.data.action ?? "ask";

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (!(await isCompanyAiEnabled(company.id))) {
    return NextResponse.json({ error: "AI add-on is not enabled for this company." }, { status: 403 });
  }
  if (!checkRateLimit(company.id, viewer.userId)) {
    return NextResponse.json({ error: "Too many requests. Please wait a few seconds." }, { status: 429 });
  }

  const viewerUser = await prisma.user.findUnique({ where: { id: viewer.userId }, select: { aiLeaderQaEnabled: true } });
  if (!viewerUser?.aiLeaderQaEnabled) {
    return NextResponse.json({ error: "LeaderGPT access is not enabled for your account." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { companyId: company.id, isActive: true, isTenantBootstrapAccount: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentId: true,
      email: true,
      username: true,
      roleLevel: { select: { name: true } },
    },
  });
  const refs = users.map((u) => ({ id: u.id, parentId: u.parentId }));
  const visibleIds = getSubtreeIds(refs, viewer.userId);
  const visibleSet = new Set(visibleIds);
  const visibleUsers = users.filter((u) => visibleSet.has(u.id));

  if (action === "confirm_bulk_create") {
    const planId = parsedReq.data.planId;
    const specHash = parsedReq.data.specHash;
    if (!planId || !specHash) {
      return NextResponse.json({ error: "planId and specHash are required" }, { status: 400 });
    }

    const plan = planMap.get(planId);
    if (!plan || plan.companyId !== company.id || plan.creatorUserId !== viewer.userId) {
      return NextResponse.json({ error: "Bulk plan not found or expired." }, { status: 404 });
    }
    if (plan.specHash !== specHash) {
      return NextResponse.json({ error: "Bulk plan validation failed. Please regenerate preview." }, { status: 409 });
    }
    if (plan.requiresSecondConfirmation && parsedReq.data.secondConfirm !== true) {
      return NextResponse.json({ error: "Second confirmation is required for this bulk size." }, { status: 400 });
    }

    const skippedOnConfirm: SkippedEntry[] = [];
    const allowedDrafts = plan.drafts.filter((d) => {
      if (!visibleSet.has(d.assigneeId)) {
        skippedOnConfirm.push({ requested: d.assigneeName, reason: "no_permission_on_confirm" });
        return false;
      }
      return true;
    });

    const now = new Date();
    let created = 0;
    for (let i = 0; i < allowedDrafts.length; i += 20) {
      const batch = allowedDrafts.slice(i, i + 20);
      const result = await prisma.task.createMany({
        data: batch.map((d) => ({
          companyId: company.id,
          creatorId: viewer.userId,
          assigneeId: d.assigneeId,
          title: d.title,
          description: [d.description, "", `created_via_ai_bulk by ${viewer.firstName} ${viewer.lastName} on ${now.toISOString()}`]
            .filter(Boolean)
            .join("\n"),
          priority: d.priority,
          dueDate: d.dueDate ? parseDueDateInput(d.dueDate) : null,
        })),
      });
      created += result.count;
    }

    // Auto-create reminders for the assignees 2 days before due date.
    const remindData = allowedDrafts
      .map((d) => {
        if (!d.dueDate) return null;
        const due = parseDueDateInput(d.dueDate);
        if (Number.isNaN(due.getTime())) return null;
        const remindAt = new Date(due.getTime() - 2 * 24 * 60 * 60 * 1000);
        if (remindAt.getTime() <= now.getTime()) return null;
        const daysUntilDue = Math.max(
          1,
          Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        );
        return {
          companyId: company.id,
          userId: d.assigneeId,
          title: `Due in ${daysUntilDue} days`,
          note: `${d.title}\nDue date: ${formatDateForReminderNote(due)}`,
          remindAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (remindData.length > 0) {
      await prisma.userReminder.createMany({ data: remindData });
    }

    planMap.delete(planId);
    return NextResponse.json({
      success: true,
      data: {
        mode: "bulk_create_result",
        summary: { requested: plan.drafts.length, created, skipped: skippedOnConfirm.length },
        skipped: skippedOnConfirm,
      },
    });
  }

  const question = (parsedReq.data.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const statusConfigs = await prisma.taskStatusConfig.findMany({
    where: { companyId: company.id },
    select: { key: true, type: true },
  });
  const doneKeys = new Set(statusConfigs.filter((s) => s.type === "DONE").map((s) => s.key));

  const [tasks, approvalsPending, remindersOverdue] = await Promise.all([
    prisma.task.findMany({
      where: { companyId: company.id, assigneeId: { in: visibleIds }, isArchived: false },
      select: { status: true, priority: true, dueDate: true, createdAt: true, completedAt: true },
    }),
    prisma.approvalRequest.count({ where: { companyId: company.id, status: "PENDING" } }),
    prisma.userReminder.count({
      where: { companyId: company.id, userId: viewer.userId, isDone: false, remindAt: { lt: now } },
    }),
  ]);

  const openTasks = tasks.filter((t) => !doneKeys.has(t.status) && t.status !== "COMPLETED");
  const openLast7d = openTasks.filter((t) => t.createdAt >= since7d).length;
  const openLast30d = openTasks.filter((t) => t.createdAt >= since30d).length;
  const completedLast7d = tasks.filter((t) => t.completedAt && t.completedAt >= since7d).length;
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < now).length;
  const highUrgent = openTasks.filter((t) => t.priority === "HIGH" || t.priority === "URGENT").length;

  const metrics: LeaderQaMetric[] = [
    { key: "M1", label: "Open tasks", value: openTasks.length, window: "now", source: "tasks" },
    { key: "M2", label: "Overdue open tasks", value: overdue, window: "now", source: "tasks" },
    { key: "M3", label: "High/Urgent open tasks", value: highUrgent, window: "now", source: "tasks" },
    { key: "M4", label: "Completed tasks", value: completedLast7d, window: "last_7d", source: "tasks" },
    { key: "M5", label: "Pending approvals", value: approvalsPending, window: "now", source: "approvals" },
    { key: "M6", label: "Overdue reminders", value: remindersOverdue, window: "now", source: "reminders" },
    { key: "M7", label: "Open tasks created", value: openLast7d, window: "last_7d", source: "tasks" },
    { key: "M8", label: "Open tasks created", value: openLast30d, window: "last_30d", source: "tasks" },
  ];

  if (maybeTaskIntent(question) && maybeBulkIntent(question)) {
    try {
      const extractPrompt = [
        "Extract a BULK task creation spec from this request.",
        "Return JSON only.",
        "targetScope must be DIRECT_REPORTS, TEAM_ALL, ROLE, or NAMES.",
        "Use NAMES and explicitNames when the user lists people.",
        "Use ROLE only when user mentions a role/group.",
        `Request: ${question}`,
      ].join("\n");
      const extracted = await generateGeminiJson<z.infer<typeof bulkSpecSchema>>({
        prompt: extractPrompt,
        responseSchema: bulkExtractSchema as unknown as Record<string, unknown>,
        retries: 1,
        timeoutMs: 10000,
        companyId: company.id,
        endpointTag: "leadergpt-bulk-extract",
      });
      const spec = bulkSpecSchema.parse(extracted);

      const skipped: SkippedEntry[] = [];
      const selectedById = new Map<string, { id: string; firstName: string; lastName: string; email: string }>();
      const pool = visibleUsers.filter((u) => u.id !== viewer.userId);

      if (spec.targetScope === "DIRECT_REPORTS") {
        for (const u of pool.filter((u) => u.parentId === viewer.userId)) selectedById.set(u.id, u);
      } else if (spec.targetScope === "TEAM_ALL") {
        for (const u of pool) selectedById.set(u.id, u);
      } else if (spec.targetScope === "ROLE") {
        const roleQ = (spec.roleName ?? "").toLowerCase().trim();
        if (!roleQ) {
          skipped.push({ requested: "role", reason: "invalid_selector" });
        } else {
          const roleTargets = pool.filter((u) => (u.roleLevel?.name ?? "").toLowerCase().includes(roleQ));
          for (const u of roleTargets) selectedById.set(u.id, u);
        }
      } else if (spec.targetScope === "NAMES") {
        const names = (spec.explicitNames ?? []).map((n) => n.trim()).filter(Boolean);
        if (names.length === 0) {
          skipped.push({ requested: "names", reason: "invalid_selector" });
        } else {
          for (const raw of names) {
            const matches = pickNameMatches(raw, pool);
            if (matches.length === 0) {
              skipped.push({ requested: raw, reason: "not_found" });
            } else if (matches.length > 1) {
              skipped.push({
                requested: raw,
                reason: "ambiguous",
                candidates: matches.slice(0, 6).map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, email: m.email })),
              });
            } else {
              selectedById.set(matches[0].id, matches[0]);
            }
          }
        }
      }

      let targets = Array.from(selectedById.values()).filter((u) => visibleSet.has(u.id));
      const droppedForPermission = Array.from(selectedById.values()).filter((u) => !visibleSet.has(u.id));
      for (const u of droppedForPermission) {
        skipped.push({ requested: `${u.firstName} ${u.lastName}`, reason: "no_permission" });
      }

      const hardCap = 50;
      const softCap = 20;
      const warnings: string[] = [];
      if (targets.length > hardCap) {
        warnings.push(`Hard cap applied: first ${hardCap} targets only.`);
        const trimmed = targets.slice(hardCap);
        for (const u of trimmed) skipped.push({ requested: `${u.firstName} ${u.lastName}`, reason: "invalid_selector" });
        targets = targets.slice(0, hardCap);
      }
      const requiresSecondConfirmation = targets.length > softCap;
      if (requiresSecondConfirmation) {
        warnings.push(`Large bulk command (${targets.length} tasks). A second confirmation is required.`);
      }

      if (targets.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            mode: "clarification",
            message: "No eligible users found for this bulk command in your visible hierarchy.",
            skipped,
          },
        });
      }

      const due = spec.dueDate ? new Date(spec.dueDate) : null;
      const safeDue = due && !Number.isNaN(due.getTime()) ? due.toISOString() : null;
      const criteriaBlock = spec.acceptanceCriteria?.length
        ? `\n\nAcceptance criteria:\n- ${spec.acceptanceCriteria.join("\n- ")}`
        : "";

      const drafts: BulkDraftTask[] = targets.map((u) => ({
        title: spec.titleTemplate.replaceAll("{{name}}", `${u.firstName} ${u.lastName}`),
        description: `${spec.description ?? ""}${criteriaBlock}`.trim(),
        assigneeId: u.id,
        assigneeName: `${u.firstName} ${u.lastName}`,
        priority: spec.priority,
        dueDate: safeDue,
      }));

      const specHash = hashDrafts(drafts);
      const planId = randomUUID();
      planMap.set(planId, {
        planId,
        companyId: company.id,
        creatorUserId: viewer.userId,
        createdAt: Date.now(),
        specHash,
        requiresSecondConfirmation,
        drafts,
      });

      return NextResponse.json({
        success: true,
        data: {
          mode: "bulk_create_preview",
          planId,
          specHash,
          count: drafts.length,
          warnings,
          skipped,
          requiresSecondConfirmation,
          drafts,
        },
      });
    } catch {
      return NextResponse.json({
        success: true,
        data: {
          mode: "clarification",
          message: "For bulk create, specify scope like direct reports/team/role/names plus title and priority.",
        },
      });
    }
  }

  if (maybeTaskIntent(question)) {
    try {
      const extractPrompt = [
        "Extract a task draft from this user request.",
        "Return JSON only.",
        "Use exact assignee name mentioned by user if present.",
        "If no due date is present, omit dueDate.",
        `Request: ${question}`,
      ].join("\n");
      const extracted = await generateGeminiJson<z.infer<typeof taskDraftSchema>>({
        prompt: extractPrompt,
        responseSchema: taskExtractSchema as unknown as Record<string, unknown>,
        retries: 1,
        timeoutMs: 10000,
        companyId: company.id,
        endpointTag: "leadergpt-task-extract",
      });
      const draft = taskDraftSchema.parse(extracted);

      const matches = pickNameMatches(draft.assigneeName, visibleUsers);
      if (matches.length === 0) {
        return NextResponse.json({ success: true, data: { mode: "clarification", message: `I could not find assignee "${draft.assigneeName}" in your visible hierarchy.` } });
      }
      if (matches.length > 1) {
        return NextResponse.json({
          success: true,
          data: {
            mode: "clarification",
            message: `I found multiple matches for "${draft.assigneeName}". Please specify one person.`,
            candidates: matches.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email })),
          },
        });
      }

      const assignee = matches[0];
      const parsedDue = draft.dueDate ? new Date(draft.dueDate) : null;
      const safeDue = parsedDue && !Number.isNaN(parsedDue.getTime()) ? parsedDue.toISOString() : null;
      return NextResponse.json({
        success: true,
        data: {
          mode: "task_proposal",
          proposal: {
            title: draft.title.trim(),
            description: (draft.description ?? "").trim(),
            assigneeId: assignee.id,
            assigneeName: `${assignee.firstName} ${assignee.lastName}`,
            priority: draft.priority,
            dueDate: safeDue,
            acceptanceCriteria: draft.acceptanceCriteria ?? [],
          },
          guardrails: {
            requiresConfirmation: true,
            permissionCheckedAtCreate: true,
            auditTrailTag: "ai_chat",
          },
        },
      });
    } catch {
      return NextResponse.json({ success: true, data: { mode: "clarification", message: "I can help create a task. Please include title, assignee, priority, and due date if any." } });
    }
  }

  let result: LeaderQaAnswer;
  let source: "ai" | "fallback" = "ai";
  try {
    const prompt = buildLeaderQaPrompt({ question, teamLabel: "Visible org scope", metrics });
    const generated = await generateGeminiJson<LeaderQaAnswer>({
      prompt,
      responseSchema: leaderQaResponseSchema as unknown as Record<string, unknown>,
      retries: 1,
      timeoutMs: 12000,
      companyId: company.id,
      endpointTag: "leadergpt-qa",
    });
    result = answerSchema.parse(generated);
  } catch (err) {
    console.error("LeaderGPT AI failed:", err);
    source = "fallback";
    result = fallbackAnswer(question, metrics);
  }

  const response: LeaderQaResponse = {
    result: { ...result, metrics },
    source,
    generatedAt: now.toISOString(),
  };
  return NextResponse.json({ success: true, data: { mode: "qa", ...response } });
}
