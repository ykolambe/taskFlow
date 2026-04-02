import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditContentEntry, isContentStudioEnabledForUser } from "@/lib/contentStudio";
import { isUserAiEnabled } from "@/lib/ai/entitlement";
import { generateGeminiJson } from "@/lib/ai/gemini";
import {
  brandHintForFallback,
  gatherBrandContextForPrompt,
  type CompanyBrandFields,
} from "@/lib/contentBrandContext";
import { formatPlatformPresetForPrompt, getContentPlatformPreset } from "@/lib/contentPlatformPresets";

const reqSchema = z.object({
  websiteUrl: z.string().max(2048).optional(),
  competitorUrls: z.string().max(8000).optional(),
  useOnlyRequestContext: z.boolean().optional(),
});

const contentResponseSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    notes: { type: "STRING" },
    url: { type: "STRING" },
  },
  required: ["title", "notes"],
} as const;

function extractContentType(notes: string | null): string | null {
  if (!notes) return null;
  const m = /^@contentType:\s*(.+)\s*$/m.exec(notes.trim());
  return m?.[1]?.trim() ?? null;
}

function extractIdeaText(notes: string | null): string {
  if (!notes) return "";
  // Remove the @contentType header if present.
  return notes.replace(/^@contentType:.*$/m, "").trim();
}

function buildFallbackDraft(params: {
  platformLabel: string;
  contentType: string;
  ideaTitle: string;
  ideaText: string;
  brandHint?: string;
}): { title: string; notes: string; url?: string } {
  const { platformLabel, contentType, ideaTitle, ideaText, brandHint } = params;
  const safeIdea = ideaText || ideaTitle;
  const draftPrefix = "Draft: ";
  const draftTitle = ideaTitle.startsWith(draftPrefix) ? ideaTitle : `${draftPrefix}${ideaTitle}`;
  return {
    title: draftTitle,
    notes: [
      `@contentType: ${contentType}`,
      "",
      ...(brandHint ? [`Brand / audience: ${brandHint}`, ""] : []),
      safeIdea,
      "",
      "Suggested draft structure:",
      "- Hook (first line):",
      "- Body (3 key points / sections):",
      "- Example / mini-story (1 paragraph):",
      "- CTA (one clear next step):",
      "- Hashtags (3-8):",
    ].join("\n"),
    url: "",
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; entryId: string }> }
) {
  const { slug, id: calendarId, entryId } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enabled = await isContentStudioEnabledForUser(user.companyId, user.userId);
  if (!enabled) return NextResponse.json({ error: "Content Studio is not enabled" }, { status: 403 });

  if (!(await isUserAiEnabled(user.companyId, user.userId))) {
    return NextResponse.json({ error: "AI is not enabled for your account." }, { status: 403 });
  }

  const bodyRaw = await req.json().catch(() => ({}));
  const parsed = reqSchema.safeParse(bodyRaw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { websiteUrl, competitorUrls, useOnlyRequestContext } = parsed.data;

  const entry = await prisma.calendarEntry.findFirst({
    where: {
      id: entryId,
      calendarId,
      companyId: user.companyId,
      kind: "CONTENT",
    },
    select: {
      id: true,
      calendarId: true,
      creatorId: true,
      title: true,
      notes: true,
      color: true,
      contentStatus: true,
      assigneeId: true,
      url: true,
      startAt: true,
    },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  if (entry.contentStatus !== "IDEA") {
    return NextResponse.json({ error: "This entry is not an IDEA" }, { status: 400 });
  }

  const cal = await prisma.calendarCollection.findFirst({
    where: { id: calendarId, companyId: user.companyId, isArchived: false, type: "CHANNEL" },
    select: { id: true, name: true, contentChannel: true, contentPlatformPreset: true },
  });
  if (!cal) return NextResponse.json({ error: "Channel calendar not found" }, { status: 404 });

  const canEdit = await canEditContentEntry(cal.id, user.companyId, user.userId, user.isSuperAdmin);
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const preset = getContentPlatformPreset(cal.contentPlatformPreset);
  const contentType = extractContentType(entry.notes) ?? "TEXT_POST";
  const ideaText = extractIdeaText(entry.notes);
  const platformLabel = cal.contentChannel?.trim() ? cal.contentChannel.trim() : preset?.label ?? cal.name;

  const companyRow = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      name: true,
      domain: true,
      contentBrandBrief: true,
      contentBrandWebsite: true,
      contentBrandCompetitorNotes: true,
    },
  });
  const companyBase: CompanyBrandFields = {
    name: companyRow?.name ?? "",
    domain: companyRow?.domain ?? null,
    contentBrandBrief: companyRow?.contentBrandBrief ?? null,
    contentBrandWebsite: companyRow?.contentBrandWebsite ?? null,
    contentBrandCompetitorNotes: companyRow?.contentBrandCompetitorNotes ?? null,
  };
  const companyForGather: CompanyBrandFields = useOnlyRequestContext
    ? {
        ...companyBase,
        contentBrandBrief: null,
        contentBrandWebsite: null,
        contentBrandCompetitorNotes: null,
      }
    : companyBase;

  const recentSnippets = await prisma.calendarEntry.findMany({
    where: {
      companyId: user.companyId,
      kind: "CONTENT",
      contentStatus: { in: ["PUBLISHED", "READY_TO_PUBLISH", "APPROVED"] },
      id: { not: entry.id },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { title: true, notes: true },
  });
  const recentContentSnippets = recentSnippets.map((e) => {
    const n = (e.notes ?? "").replace(/^@contentType:.*$/m, "").trim().slice(0, 220);
    return `${e.title}${n ? ` — ${n}` : ""}`;
  });

  const { contextText, sources } = await gatherBrandContextForPrompt({
    company: companyForGather,
    websiteUrlOverride: websiteUrl?.trim() || null,
    competitorUrlsOverride: competitorUrls?.trim() || null,
    recentContentSnippets,
  });

  const prompt = [
    "You transform a social content idea into a ready-to-review draft for the same platform.",
    "Return strict JSON only (no markdown, no prose outside JSON).",
    "",
    "Use the BUSINESS CONTEXT below for tone, audience, and specifics. Avoid generic filler; align with this organization.",
    "",
    "BUSINESS CONTEXT:",
    contextText || "(No extra context — use organization name from idea only.)",
    "",
    `Context sources: ${sources.join(", ") || "tenant:name only"}`,
    "",
    "PLATFORM STYLE (match format, tone, and purpose):",
    formatPlatformPresetForPrompt(preset, platformLabel),
    "",
    `Platform label: ${platformLabel}`,
    `Content type: ${contentType}`,
    `Idea title: ${entry.title}`,
    "",
    "Idea details (from @contentType and ideaNotes):",
    ideaText,
    "",
    "Generate:",
    "- title: an improved headline/title for this specific draft",
    "- notes: the full content draft (copy/caption) with suggested structure; include key message + CTA + 3-8 relevant hashtags if appropriate for the platform",
    "- url: leave as empty string if none",
    "",
    "Keep it practical and platform-appropriate (tone: professional, helpful, non-spammy).",
  ].join("\n");

  let source: "ai" | "fallback" = "ai";
  let result: { title: string; notes: string; url?: string };
  try {
    result = await generateGeminiJson<{ title: string; notes: string; url?: string }>({
      prompt,
      responseSchema: contentResponseSchema,
      companyId: user.companyId,
      endpointTag: "content-studio-generate-content",
    });
  } catch {
    source = "fallback";
    result = buildFallbackDraft({
      platformLabel,
      contentType,
      ideaTitle: entry.title,
      ideaText: ideaText,
      brandHint: brandHintForFallback(companyForGather),
    });
  }

  const updated = await prisma.calendarEntry.update({
    where: { id: entry.id },
    data: {
      title: result.title,
      notes: result.notes,
      url: typeof result.url === "string" ? (result.url.trim() || null) : entry.url,
      contentStatus: "DRAFT",
      approvedById: null,
      approvedAt: null,
    },
  });

  return NextResponse.json({ success: true, data: updated, source, contextSources: sources });
}

