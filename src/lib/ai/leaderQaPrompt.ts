import type { LeaderQaMetric } from "@/lib/ai/types";
import type { LeaderQaOrgContext } from "@/lib/ai/leaderQaOrgContext";

export const leaderQaResponseSchema = {
  type: "OBJECT",
  properties: {
    answer: { type: "STRING" },
    topDrivers: { type: "ARRAY", items: { type: "STRING" } },
    actions: { type: "ARRAY", items: { type: "STRING" } },
    confidence: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"] },
    citations: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["answer", "topDrivers", "actions", "confidence", "citations"],
} as const;

export function buildLeaderQaPrompt(input: {
  question: string;
  teamLabel: string;
  metrics: LeaderQaMetric[];
  orgContext: LeaderQaOrgContext;
}): string {
  return [
    "You are a leadership analytics assistant for this workspace.",
    "Respond with JSON only. Do not use markdown.",
    "Use only the provided Metrics and OrgContext payloads. Do not invent tasks, people, ideas, or calendar items.",
    "If the question is not about leadership, team operations, or the data in Metrics/OrgContext (for example general knowledge, coding, homework, creative writing, or unrelated personal topics), do not fabricate org facts: set answer to a one- or two-sentence explanation that LeaderGPT only supports workspace and team questions, set topDrivers and actions to empty arrays, set citations to an empty array, and set confidence to LOW.",
    "For numeric rollups, cite metric keys (M1, M2, …). For named items (titles, people), tie them to fields in OrgContext (e.g. openTasksSample, teamMembers, pendingTaskRequests).",
    "OrgContext includes: team members and reporting edges, open task samples, pending task requests, ideas, active recurring schedules, upcoming calendar goals/milestones, and the user's own reminder summary.",
    "Keep answer concise and action-oriented.",
    "",
    `Question: ${input.question}`,
    `Scope: ${input.teamLabel}`,
    "Metrics:",
    JSON.stringify(input.metrics),
    "OrgContext:",
    JSON.stringify(input.orgContext),
  ].join("\n");
}

