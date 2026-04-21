import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/gemini";

/** Shown when the question is not about workspace / leadership context. */
export const LEADER_GPT_OFF_TOPIC_MESSAGE =
  "LeaderGPT only answers questions about your team and work in this workspace—tasks, workload, priorities, people you can see here, approvals, reminders, recurring work, ideas, task requests, and related calendar items. For general knowledge, coding help, homework, or unrelated topics, please use a general assistant outside this app.";

const verdictSchema = z.object({
  verdict: z.enum(["IN_SCOPE", "OUT_OF_SCOPE"]),
});

export const leaderGptScopeVerdictGeminiSchema = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["IN_SCOPE", "OUT_OF_SCOPE"] },
  },
  required: ["verdict"],
} as const;

export function buildLeaderGptScopeCheckPrompt(question: string): string {
  return [
    "You are a strict scope classifier for LeaderGPT, an in-app assistant for people managers.",
    "Output JSON only with one field: verdict = IN_SCOPE or OUT_OF_SCOPE.",
    "",
    "IN_SCOPE — choose when the message is about any of the following (including typos or informal phrasing):",
    "- Tasks, deadlines, workload, overload, bottlenecks, status, priorities, delegation, assignees, overdue work, completed work, throughput.",
    "- Team, direct reports, roles, or people in a management or staffing context.",
    "- Approvals, task requests, ideas, recurring schedules, reminders, calendar milestones or goals in a work context.",
    "- Summaries, risks, plans, retrospectives, or next steps for delivery—when clearly about running the team or operations.",
    "- How to word or structure work, follow-ups, check-ins, or cadences for the team.",
    "- Very short follow-ups that only make sense after a work discussion (e.g. \"why?\", \"what next?\", \"go deeper\", \"examples\")—treat as IN_SCOPE.",
    "- Simple greetings or thanks (\"hi\", \"hello\", \"thanks\")—IN_SCOPE.",
    "",
    "OUT_OF_SCOPE — choose when the message is primarily about:",
    "- General knowledge, trivia, history, geography, or science with no clear link to managing this workspace.",
    "- Coding, debugging, APIs, algorithms, or developer tools—unless the user is clearly asking about fields or behavior of this task-management product itself.",
    "- Creative writing (poems, stories, songs), games, riddles, or entertainment.",
    "- Translation or rewriting of arbitrary text unrelated to work tasks.",
    "- Medical, legal, tax, investment, or personal life advice not tied to workplace operations.",
    "- Homework, exam problems, or math/logic puzzles unrelated to team delivery.",
    "- Unrelated software how-tos (Excel, Photoshop, etc.) unless clearly about reporting or tracking team work.",
    "",
    "Rules:",
    "- If it could reasonably be about managing work or the team, choose IN_SCOPE.",
    "- When genuinely unsure, prefer IN_SCOPE.",
    "",
    `User message:\n${JSON.stringify(question)}`,
  ].join("\n");
}

/**
 * Classifies whether a LeaderGPT question should receive an org-grounded answer.
 * On model/parse failure, returns IN_SCOPE so the main prompt (with its own guardrails) still runs.
 */
export async function classifyLeaderGptQuestionScope(
  question: string,
  companyId: string
): Promise<"IN_SCOPE" | "OUT_OF_SCOPE"> {
  const raw = await generateGeminiJson<{ verdict: string }>({
    prompt: buildLeaderGptScopeCheckPrompt(question),
    responseSchema: leaderGptScopeVerdictGeminiSchema as unknown as Record<string, unknown>,
    retries: 1,
    timeoutMs: 8000,
    companyId,
    endpointTag: "leadergpt-scope",
  });
  const parsed = verdictSchema.safeParse(raw);
  if (!parsed.success) return "IN_SCOPE";
  return parsed.data.verdict;
}
