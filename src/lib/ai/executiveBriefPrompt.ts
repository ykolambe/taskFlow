import { ExecutiveBriefContext } from "@/lib/ai/types";

export const executiveBriefJsonSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    whatChanged: { type: "ARRAY", items: { type: "STRING" } },
    topRisks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          why: { type: "STRING" },
          severity: { type: "STRING", enum: ["HIGH", "MEDIUM", "LOW"] },
        },
        required: ["title", "why", "severity"],
      },
    },
    decisionsNeeded: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          decision: { type: "STRING" },
          impact: { type: "STRING" },
          recommendedOwner: { type: "STRING" },
        },
        required: ["decision", "impact", "recommendedOwner"],
      },
    },
    next7Days: { type: "ARRAY", items: { type: "STRING" } },
    confidence: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"] },
    sourceNote: { type: "STRING" },
  },
  required: [
    "summary",
    "whatChanged",
    "topRisks",
    "decisionsNeeded",
    "next7Days",
    "confidence",
    "sourceNote",
  ],
} as const;

export function buildExecutiveBriefPrompt(context: ExecutiveBriefContext): string {
  return [
    "You are an executive chief-of-staff analyst.",
    "Output strict JSON only, no markdown, no prose outside JSON.",
    "Be concise, factual, action-oriented, and avoid generic statements.",
    "Use only provided data. If uncertain, lower confidence and state why in sourceNote.",
    "",
    "Required JSON fields:",
    "- summary: 2-3 sentence business summary",
    "- whatChanged: 2-4 bullets (last 24h deltas)",
    "- topRisks: up to 3 items with severity",
    "- decisionsNeeded: up to 3 leadership decisions",
    "- next7Days: up to 5 concrete actions",
    "- confidence: LOW|MEDIUM|HIGH",
    "- sourceNote: one sentence on data basis",
    "",
    "Context JSON:",
    JSON.stringify(context),
  ].join("\n");
}
