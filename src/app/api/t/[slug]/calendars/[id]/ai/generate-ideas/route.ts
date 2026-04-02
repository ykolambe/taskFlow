import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditContentEntry, isContentStudioEnabledForUser } from "@/lib/contentStudio";
import { isUserAiEnabled } from "@/lib/ai/entitlement";
import { generateGeminiJson } from "@/lib/ai/gemini";

const reqSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(30),
  replaceExistingIdeas: z.boolean().optional(),
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

function guessContentType(platformLabel: string): string {
  const l = platformLabel.toLowerCase();
  if (l.includes("linkedin")) return "TEXT_POST";
  if (l.includes("instagram")) return "REEL";
  if (l.includes("facebook")) return "FEED_POST";
  if (l.includes("x") || l.includes("twitter")) return "THREAD";
  if (l.includes("youtube")) return "VIDEO_SCRIPT";
  if (l.includes("tiktok")) return "SHORT_VIDEO";
  return "TEXT_POST";
}

function fallbackIdeaNotes(platformLabel: string, date: string): string {
  const contentType = guessContentType(platformLabel);
  const l = platformLabel.trim() ? platformLabel.trim() : "this platform";
  return [
    `Angle: "1 practical takeaway for ${l} on ${date}".`,
    `Structure: Hook -> 3 quick points -> mini-example -> takeaway summary.`,
    `CTA: Ask a question that invites comments (keep it under 140 chars).`,
    `Hashtags: suggest 3-7 relevant tags for ${contentType} audiences.`,
  ].join("\n- ");
}

function buildFallbackIdeas(dates: string[], platformLabel: string): IdeaOutput[] {
  const contentType = guessContentType(platformLabel);
  return dates.map((date) => ({
    date,
    title: `${platformLabel || "Platform"}: post idea for ${date}`,
    contentType,
    ideaNotes: fallbackIdeaNotes(platformLabel, date),
  }));
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

  const { startDate, days, replaceExistingIdeas } = parsedReq.data;
  const replace = replaceExistingIdeas ?? true;

  const cal = await prisma.calendarCollection.findFirst({
    where: { id, companyId: user.companyId, isArchived: false, type: "CHANNEL" },
    select: { id: true, name: true, contentChannel: true },
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

  const platformLabel = cal.contentChannel?.trim() ? cal.contentChannel.trim() : cal.name;

  const prompt = [
    "You generate social media content ideas for a specific platform/channel.",
    "Return strict JSON only (no markdown, no prose).",
    "",
    `Platform label: ${platformLabel}`,
    `Board calendar name: ${cal.name}`,
    "",
    "Create exactly one idea per date. Each idea must include:",
    "- date (YYYY-MM-DD, must match requested dates)",
    "- title (short, descriptive)",
    "- contentType (the format/type for that platform, e.g. LinkedIn: TEXT_POST|CAROUSEL|ARTICLE|POLL, Instagram: REEL|CAROUSEL|STORY|FEED_POST, etc.)",
    "- ideaNotes (2-6 bullet points worth of guidance: angle, key message, suggested structure, CTA, hashtags suggestions if appropriate)",
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
    result = { ideas: buildFallbackIdeas(dates, platformLabel) };
  }

  const created = await prisma.$transaction(async (tx) => {
    const rows = result.ideas
      .filter((it) => dates.includes(it.date))
      .slice(0, days)
      .map((it) => ({
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

  return NextResponse.json({ success: true, createdCount: created, source });
}

