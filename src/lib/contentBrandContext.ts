/**
 * Lightweight "RAG" for Content Studio: combine tenant-supplied copy + fetched public page text.
 * No vector DB; we truncate and pass as prompt context. URLs are fetch-guarded against basic SSRF.
 */

const MAX_PER_PAGE = 6000;
const MAX_TOTAL_CONTEXT = 14000;
const MAX_COMPETITOR_FETCHES = 3;

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function isPrivateOrBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "0.0.0.0") return true;
  if (h === "169.254.169.254") return true;
  if (h === "localhost" || h.endsWith(".localhost")) return process.env.NODE_ENV !== "development";
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 127) return process.env.NODE_ENV !== "development";
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (h.includes(":")) {
    if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  }
  return false;
}

export function assertUrlSafeForServerFetch(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Invalid URL");
  }
  const isHttps = url.protocol === "https:";
  const isHttpLocal =
    url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (!isHttps && !(process.env.NODE_ENV === "development" && isHttpLocal)) {
    throw new Error("Only HTTPS URLs are allowed for fetching (HTTP allowed on localhost in development only)");
  }
  if (isPrivateOrBlockedHostname(url.hostname)) {
    throw new Error("This host is not allowed for content fetching");
  }
  return url;
}

async function fetchUrlPlainText(rawUrl: string, label: string): Promise<string | null> {
  try {
    const url = assertUrlSafeForServerFetch(rawUrl);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 14_000);
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent": "TaskFlowContentBot/1.0 (+https://taskflow)",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const raw = await res.text();
    return stripHtmlToText(raw).slice(0, MAX_PER_PAGE);
  } catch (e) {
    console.error(`[contentBrandContext] fetch failed ${label}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

function parseUrlList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const parts = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (p.startsWith("http://") || p.startsWith("https://")) {
      out.push(p);
    }
  }
  return out.slice(0, MAX_COMPETITOR_FETCHES);
}

export type CompanyBrandFields = {
  name: string;
  domain: string | null;
  contentBrandBrief: string | null;
  contentBrandWebsite: string | null;
  contentBrandCompetitorNotes: string | null;
};

export type BrandContextGatherOpts = {
  company: CompanyBrandFields;
  /** One-off website for this run (overrides saved website when set). */
  websiteUrlOverride?: string | null;
  /** Extra newline- or comma-separated URLs for this run (merged with saved competitor notes). */
  competitorUrlsOverride?: string | null;
  /** Recent published/draft titles/snippets from this tenant (optional). */
  recentContentSnippets?: string[];
};

/**
 * Returns a single text block for Gemini prompts plus human-readable source labels.
 */
export async function gatherBrandContextForPrompt(opts: BrandContextGatherOpts): Promise<{
  contextText: string;
  sources: string[];
}> {
  const sources: string[] = [];
  const chunks: string[] = [];

  const { company } = opts;
  chunks.push(`Organization name: ${company.name}`);
  if (company.domain?.trim()) {
    chunks.push(`Known domain: ${company.domain.trim()}`);
    sources.push("tenant:domain");
  }
  if (company.contentBrandBrief?.trim()) {
    chunks.push(`Brand / business brief (from tenant):\n${company.contentBrandBrief.trim()}`);
    sources.push("tenant:contentBrandBrief");
  }

  const siteUrl = (opts.websiteUrlOverride?.trim() || company.contentBrandWebsite?.trim() || "").trim();
  if (siteUrl) {
    const page = await fetchUrlPlainText(siteUrl, "primary-site");
    if (page) {
      chunks.push(`Public website text (truncated) from ${siteUrl}:\n${page}`);
      sources.push(`fetch:${siteUrl}`);
    } else {
      chunks.push(`Website URL was provided but could not be fetched: ${siteUrl}`);
      sources.push(`fetch-failed:${siteUrl}`);
    }
  }

  const mergedCompetitors = [company.contentBrandCompetitorNotes, opts.competitorUrlsOverride]
    .filter(Boolean)
    .join("\n");
  const compUrls = parseUrlList(mergedCompetitors);
  let i = 0;
  for (const u of compUrls) {
    if (i >= MAX_COMPETITOR_FETCHES) break;
    const page = await fetchUrlPlainText(u, `competitor-${i}`);
    if (page) {
      chunks.push(`Reference page text (truncated) from ${u}:\n${page}`);
      sources.push(`fetch:${u}`);
    }
    i += 1;
  }
  if (mergedCompetitors.trim() && !compUrls.length) {
    chunks.push(`Competitor / reference notes (not URLs; used as-is):\n${mergedCompetitors.trim().slice(0, 4000)}`);
    sources.push("tenant:competitorNotes");
  }

  if (opts.recentContentSnippets?.length) {
    const joined = opts.recentContentSnippets
      .filter(Boolean)
      .slice(0, 12)
      .join("\n---\n")
      .slice(0, 4000);
    if (joined) {
      chunks.push(`Recent content titles/notes from this tenant (for tone and topics):\n${joined}`);
      sources.push("tenant:recentContent");
    }
  }

  let contextText = chunks.join("\n\n");
  if (contextText.length > MAX_TOTAL_CONTEXT) {
    contextText = contextText.slice(0, MAX_TOTAL_CONTEXT) + "\n[...truncated]";
  }

  return { contextText, sources };
}

export function brandHintForFallback(company: CompanyBrandFields): string {
  const b = company.contentBrandBrief?.trim();
  if (b) return b.slice(0, 280);
  const n = company.name.trim();
  return n || "your organization";
}
