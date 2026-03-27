import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveSecretRef } from "@/lib/secrets";

const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() })).optional(),
        }).optional(),
      })
    )
    .optional(),
});

export interface GeminiGenerateOptions {
  prompt: string;
  responseSchema?: Record<string, unknown>;
  model?: string;
  timeoutMs?: number;
  retries?: number;
  companyId?: string;
  endpointTag?: string;
}

function extractJsonLikeText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```") && trimmed.includes("```")) {
    return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

export async function generateGeminiJson<T>(options: GeminiGenerateOptions): Promise<T> {
  let apiKey = process.env.GEMINI_API_KEY ?? null;
  let model = options.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  let provider = "gemini";

  if (options.companyId) {
    const infra = await prisma.tenantInfraConfig.findUnique({
      where: { companyId: options.companyId },
      select: {
        aiProvider: true,
        aiModel: true,
        aiApiKeySecretRef: true,
        aiRequestBudgetDaily: true,
        aiRequestCountDaily: true,
        aiBudgetResetAt: true,
      },
    });
    if (infra) {
      provider = infra.aiProvider ?? provider;
      model = options.model ?? infra.aiModel ?? model;
      const keyFromRef = resolveSecretRef(infra.aiApiKeySecretRef);
      apiKey = keyFromRef ?? apiKey;

      const now = new Date();
      const needsReset = !infra.aiBudgetResetAt || infra.aiBudgetResetAt <= now;
      if (needsReset) {
        const resetAt = new Date(now);
        resetAt.setUTCHours(24, 0, 0, 0);
        await prisma.tenantInfraConfig.update({
          where: { companyId: options.companyId },
          data: { aiRequestCountDaily: 0, aiBudgetResetAt: resetAt },
        });
      } else if (
        infra.aiRequestBudgetDaily !== null &&
        infra.aiRequestBudgetDaily !== undefined &&
        infra.aiRequestCountDaily >= infra.aiRequestBudgetDaily
      ) {
        throw new Error("Tenant AI daily request budget exceeded");
      }
    }
  }
  if (!apiKey) throw new Error("Tenant AI API key is missing");

  const timeoutMs = options.timeoutMs ?? 12000;
  const retries = options.retries ?? 1;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: options.prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
              ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
            },
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`Gemini request failed (${res.status})`);
      }

      const json = geminiResponseSchema.parse(await res.json());
      const text =
        json.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("\n")
          .trim() ?? "";

      if (!text) throw new Error("Gemini returned empty response");
      const parsed = JSON.parse(extractJsonLikeText(text)) as T;
      if (options.companyId) {
        await prisma.$transaction([
          prisma.tenantInfraConfig.updateMany({
            where: { companyId: options.companyId },
            data: { aiRequestCountDaily: { increment: 1 } },
          }),
          prisma.tenantAiUsageLog.create({
            data: {
              companyId: options.companyId,
              endpoint: options.endpointTag ?? "generic",
              provider,
              model,
            },
          }),
        ]);
      }
      return parsed;
    } catch (err) {
      lastError = err;
      if (attempt >= retries) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}
