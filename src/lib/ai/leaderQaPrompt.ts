import type { LeaderQaMetric } from "@/lib/ai/types";

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
}): string {
  return [
    "You are a leadership analytics assistant.",
    "Respond with JSON only. Do not use markdown.",
    "Use only the provided metrics and do not invent facts.",
    "Citations must reference metric keys, e.g. M1, M2.",
    "Keep answer concise and action-oriented.",
    "",
    `Question: ${input.question}`,
    `Scope: ${input.teamLabel}`,
    "Metrics:",
    JSON.stringify(input.metrics),
  ].join("\n");
}

