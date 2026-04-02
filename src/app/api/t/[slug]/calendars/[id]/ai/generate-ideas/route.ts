import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
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
import {
  formatPlatformPresetForPrompt,
  getContentPlatformPreset,
  pickContentTypeForDayIndex,
} from "@/lib/contentPlatformPresets";

const reqSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(30),
  replaceExistingIdeas: z.boolean().optional(),
  /** One-off public site to fetch for this run (overrides saved company website when set). */
  websiteUrl: z.string().max(2048).optional(),
  /** Extra competitor / reference URLs (newline- or comma-separated). */
  competitorUrls: z.string().max(8000).optional(),
  /** When true, do not use saved brief / saved website / saved competitor notes; still uses org name + request fields. */
  useOnlyRequestContext: z.boolean().optional(),
});

type IdeaOutput = {
  date: string; // YYYY-MM-DD
  title: string;
  contentType: string;
  ideaNotes: string;
};

const ideasResponseSchema = {
  type: "OBJECT",
  properties: {
    ideas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" },
          title: { type: "STRING" },
          contentType: { type: "STRING" },
          ideaNotes: { type: "STRING" },
        },
        required: ["date", "title", "contentType", "ideaNotes"],
      },
    },
  },
  required: ["ideas"],
} as const;

function parseDateOnly(input: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) return new Date();
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);
  return new Date(year, monthIndex, day);
}

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toStoredStartAt(dateOnly: string): Date {
  // Match ContentStudioView: `${yyyy-MM-dd}T12:00:00` then toISOString()
  return new Date(`${dateOnly}T12:00:00`);
}

function fallbackIdeaNotes(
  platformLabel: string,
  date: string,
  contentType: string,
  preset: ReturnType<typeof getContentPlatformPreset>
): string {
  const l = platformLabel.trim() ? platformLabel.trim() : "this platform";
  return [
    `Format: ${contentType} — angle: one practical takeaway for ${l} on ${date}.`,
    `Structure: Hook -> 3 quick points -> mini-example -> takeaway summary.`,
    `CTA: Ask a question that invites comments (keep it under 140 chars).`,
    `Hashtags: suggest 3-7 relevant tags for ${contentType} audiences.`,
  ].join("\n- ");
}

function singleFallbackIdea(
  date: string,
  platformLabel: string,
  brandHint: string,
  preset: ReturnType<typeof getContentPlatformPreset>,
  dayIndex: number
): IdeaOutput {
  const contentType = pickContentTypeForDayIndex(preset, platformLabel.toLowerCase(), dayIndex);
  const org = brandHint.trim() || platformLabel || "your organization";
  const dayTag = format(parseDateOnly(date), "EEE MMM d");
  return {
    date,
    title: `${platformLabel || "Platform"}: ${org} — ${contentType.replace(/_/g, " ")} (${dayTag})`,
    contentType,
    ideaNotes: [
      `Audience / brand: ${org}.`,
      fallbackIdeaNotes(platformLabel, date, contentType, preset),
    ].join("\n- "),
  };
}

function buildFallbackIdeas(
  dates: string[],
  platformLabel: string,
  brandHint: string,
  preset: ReturnType<typeof getContentPlatformPreset>
): IdeaOutput[] {
  return dates.map((date, i) => singleFallbackIdea(date, platformLabel, brandHint, preset, i));
}

/**
 * One idea per requested date; fill gaps from template. Models often repeat titles — fix below.
 */
function alignIdeasToDates(
  dates: string[],
  raw: IdeaOutput[],
  platformLabel: string,
  brandHint: string,
  preset: ReturnType<typeof getContentPlatformPreset>
): IdeaOutput[] {
  const byDate = new Map<string, IdeaOutput>();
  for (const it of raw) {
    if (!it?.date || !dates.includes(it.date)) continue;
    if (!byDate.has(it.date)) byDate.set(it.date, it);
  }
  return dates.map((date, i) =>
    byDate.has(date) ? byDate.get(date)! : singleFallbackIdea(date, platformLabel, brandHint, preset, i)
  );
}

/** If the model returns the same title for multiple days, make titles unique (readable). */
function dedupeTitlesAcrossDays(ideas: IdeaOutput[]): IdeaOutput[] {
  const used = new Set<string>();
  return ideas.map((idea) => {
    let title = idea.title.trim();
    let key = title.toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      return { ...idea, title };
    }
    const d = parseDateOnly(idea.date);
    const suffix = format(d, "EEE MMM d");
    title = `${idea.title.trim()} · ${suffix}`;
    key = title.toLowerCase();
    let n = 2;
    while (used.has(key)) {
      title = `${idea.title.trim()} · ${suffix} (${n})`;
      key = title.toLowerCase();
      n += 1;
    }
    used.add(key);
    return { ...idea, title };
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enabled = await isContentStudioEnabledForUser(user.companyId, user.userId);
  if (!enabled) return NextResponse.json({ error: "Content Studio is not enabled" }, { status: 403 });

  if (!(await isUserAiEnabled(user.companyId, user.userId))) {
    return NextResponse.json({ error: "AI is not enabled for your account." }, { status: 403 });
  }

  const bodyRaw = await req.json().catch(() => ({}));
  const parsedReq = reqSchema.safeParse(bodyRaw);
  if (!parsedReq.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { startDate, days, replaceExistingIdeas, websiteUrl, competitorUrls, useOnlyRequestContext } =
    parsedReq.data;
  const replace = replaceExistingIdeas ?? true;

  const cal = await prisma.calendarCollection.findFirst({
    where: { id, companyId: user.companyId, isArchived: false, type: "CHANNEL" },
    select: { id: true, name: true, contentChannel: true, contentPlatformPreset: true },
  });
  if (!cal) return NextResponse.json({ error: "Channel calendar not found" }, { status: 404 });

  const canEdit = await canEditContentEntry(cal.id, user.companyId, user.userId, user.isSuperAdmin);
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const start = parseDateOnly(startDate);
  const dates: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(formatDateOnly(d));
  }

  if (replace) {
    const startAt = toStoredStartAt(dates[0]);
    const endAt = toStoredStartAt(dates[dates.length - 1]);
    await prisma.calendarEntry.deleteMany({
      where: {
        calendarId: cal.id,
        companyId: user.companyId,
        kind: "CONTENT",
        contentStatus: "IDEA",
        startAt: { gte: startAt, lte: endAt },
      },
    });
  }

  const preset = getContentPlatformPreset(cal.contentPlatformPreset);
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
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
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

  const allowedContentTypes =
    preset?.defaultContentTypes?.length
      ? preset.defaultContentTypes.join(", ")
      : "TEXT_POST, CAROUSEL, SHORT_VIDEO, REEL, FEED_POST";

  const prompt = [
    "You generate social media content ideas for a specific platform/channel.",
    "Return strict JSON only (no markdown, no prose).",
    "",
    "Use the BUSINESS CONTEXT below to tailor every idea: speak to the real audience, services, and tone of this organization.",
    "Do not produce generic marketing filler; reference concrete themes from the context when possible (courses, outcomes, exams, location, differentiators).",
    "If context is thin, still stay specific to the organization name and platform.",
    "",
    `Platform label: ${platformLabel}`,
    `Board calendar name: ${cal.name}`,
    "",
    "PLATFORM STYLE (follow these formats, tone, and posting purpose):",
    formatPlatformPresetForPrompt(preset, platformLabel),
    "",
    "BUSINESS CONTEXT (may include fetched website text and tenant notes):",
    contextText || "(No extra context provided — use organization name and platform only.)",
    "",
    `Context sources used: ${sources.join(", ") || "tenant:name only"}`,
    "",
    "Create exactly one idea per date. Each idea must include:",
    "- date (YYYY-MM-DD, must match requested dates)",
    "- title (short, descriptive; should reflect this business, not generic social media advice)",
    `- contentType — MUST be one of these for this channel: ${allowedContentTypes}. Use UPPER_SNAKE_CASE. Do not use a vague label like POST or GENERIC unless the platform list literally includes it.`,
    "- ideaNotes (2-6 bullet points worth of guidance: angle, key message, suggested structure, CTA, hashtags suggestions if appropriate)",
    "",
    "CRITICAL — format variety (not just “a post”):",
    "- Each idea must match its contentType. Describe that format in the notes: e.g. for REEL/SHORT_VIDEO — hook, shots/beats, on-screen text; for CAROUSEL — slide themes and order; for STORY — sequence of frames/polls/stickers; for FEED_POST — caption structure; for EVENT — date/time/location CTA.",
    `- Across the date range, rotate through several different contentTypes from the list above (e.g. Instagram: REEL, CAROUSEL, STORY, FEED_POST; Facebook: FEED_POST, EVENT, SHORT_VIDEO; TikTok: SHORT_VIDEO, TUTORIAL_HOOK, TREND_STITCH, SERIES_PART; LinkedIn: TEXT_POST, CAROUSEL, POLL; YouTube: VIDEO_SCRIPT, SHORT, COMMUNITY_POST). Do not output the same contentType for every day when the list has more than one option.`,
    "",
    "CRITICAL — variety across days:",
    "- Each date MUST get a different theme/angle than the other dates (e.g. tip Monday, student win Tuesday, myth-vs-fact Wednesday, event/reminder Thursday, FAQ Friday).",
    "- Do NOT copy-paste the same title or the same ideaNotes for multiple dates. Titles must be unique across the list.",
    "- Tie each idea to that specific day in the title or notes (e.g. mention the day of week or a reason this fits that date).",
    "",
    "Requested dates JSON:",
    JSON.stringify({ dates }),
  ].join("\n");

  let source: "ai" | "fallback" = "ai";
  let result: { ideas: IdeaOutput[] };
  try {
    result = await generateGeminiJson<{ ideas: IdeaOutput[] }>({
      prompt,
      responseSchema: ideasResponseSchema,
      companyId: user.companyId,
      endpointTag: "content-studio-generate-ideas",
    });
  } catch {
    source = "fallback";
    result = {
      ideas: buildFallbackIdeas(dates, platformLabel, brandHintForFallback(companyForGather), preset),
    };
  }

  const brandHint = brandHintForFallback(companyForGather);
  const normalizedIdeas = dedupeTitlesAcrossDays(
    alignIdeasToDates(dates, result.ideas, platformLabel, brandHint, preset)
  );

  const created = await prisma.$transaction(async (tx) => {
    const rows = normalizedIdeas.map((it) => ({
        companyId: user.companyId,
        calendarId: cal.id,
        creatorId: user.userId,
        kind: "CONTENT" as const,
        title: it.title,
        notes: `@contentType: ${it.contentType}\n\n${it.ideaNotes}`,
        color: cal.contentChannel ? "#6366f1" : "#22c55e",
        startAt: toStoredStartAt(it.date),
        endAt: null,
        isDone: false,
        contentStatus: "IDEA" as const,
        assigneeId: null,
        url: null,
        approvedById: null,
        approvedAt: null,
      }));

    // If replace=false, only insert ones that don't already exist on that day as IDEA entries.
    if (!replace) {
      const existing = await tx.calendarEntry.findMany({
        where: {
          calendarId: cal.id,
          companyId: user.companyId,
          kind: "CONTENT",
          contentStatus: "IDEA",
          startAt: {
            gte: toStoredStartAt(dates[0]),
            lte: toStoredStartAt(dates[dates.length - 1]),
          },
        },
        select: { startAt: true },
      });
      const existSet = new Set(existing.map((e) => e.startAt.toISOString()));
      const filtered = rows.filter((r) => !existSet.has(r.startAt.toISOString()));
      await tx.calendarEntry.createMany({ data: filtered });
      return filtered.length;
    }

    await tx.calendarEntry.createMany({ data: rows });
    return rows.length;
  });

  return NextResponse.json({
    success: true,
    createdCount: created,
    source,
    contextSources: sources,
  });
}

