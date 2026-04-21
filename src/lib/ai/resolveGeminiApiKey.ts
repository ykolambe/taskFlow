import { resolveSecretRef } from "@/lib/secrets";

/** Typical Google AI Studio / Gemini API keys start with this prefix. */
function looksLikeGoogleGeminiApiKey(value: string): boolean {
  const v = value.trim();
  return v.length >= 24 && /^AIza[a-zA-Z0-9_-]+$/.test(v);
}

export type TenantInfraGeminiKeyFields = {
  geminiApiKeyTenant: string | null;
  geminiApiKeyPlatform: string | null;
  aiApiKeySecretRef: string | null;
};

/**
 * Resolution order: tenant super-admin key → platform-stored key → secret ref / env map / literal ref → GEMINI_API_KEY.
 */
export function resolveGeminiApiKeyForInfra(infra: TenantInfraGeminiKeyFields | null | undefined): string | null {
  const tenant = infra?.geminiApiKeyTenant?.trim();
  if (tenant) return tenant;

  const platform = infra?.geminiApiKeyPlatform?.trim();
  if (platform) return platform;

  const ref = infra?.aiApiKeySecretRef?.trim();
  if (ref) {
    const resolved = resolveSecretRef(ref)?.trim();
    if (!resolved) {
      // fall through to env
    } else if (resolved !== ref || looksLikeGoogleGeminiApiKey(resolved)) {
      return resolved;
    }
  }

  const env = process.env.GEMINI_API_KEY?.trim();
  return env || null;
}
