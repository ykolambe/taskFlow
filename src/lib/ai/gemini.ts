import { z } from "zod";

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
}

function extractJsonLikeText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```") && trimmed.includes("```")) {
    return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

export async function generateGeminiJson<T>(options: GeminiGenerateOptions): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const model = options.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
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
      return JSON.parse(extractJsonLikeText(text)) as T;
    } catch (err) {
      lastError = err;
      if (attempt >= retries) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}
