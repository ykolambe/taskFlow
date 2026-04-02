/**
 * Readymade social platforms for Content Studio channel boards.
 * Drives labels, AI tone/format hints, and fallback content-type guesses.
 */

export const CONTENT_PLATFORM_PRESET_IDS = [
  "linkedin",
  "instagram",
  "facebook",
  "x",
  "youtube",
  "tiktok",
  "threads",
  "custom",
] as const;

export type ContentPlatformPresetId = (typeof CONTENT_PLATFORM_PRESET_IDS)[number];

export type ContentPlatformPreset = {
  id: ContentPlatformPresetId;
  /** UI + default contentChannel tag */
  label: string;
  /** One-line purpose for AI */
  purpose: string;
  /** Voice / style */
  tone: string;
  /** Typical post shapes */
  suggestedFormats: string[];
  /** Passed to Gemini as platform-specific rules */
  aiGuidance: string;
  /** Default contentType values for this platform (first = default fallback) */
  defaultContentTypes: string[];
};

export const CONTENT_PLATFORM_PRESETS: ContentPlatformPreset[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    purpose: "Professional B2B / employer brand, thought leadership, hiring, industry credibility.",
    tone: "Professional, clear, insight-led; avoid clickbait; use line breaks and optional bullets.",
    suggestedFormats: ["TEXT_POST", "CAROUSEL (document)", "POLL", "ARTICLE link post", "IMAGE + short caption"],
    aiGuidance:
      "Optimize for LinkedIn: hook in first line, value in 3-5 short paragraphs or bullets, optional CTA (comment/follow/DM). Hashtags: 3-5 relevant, not spam. Mention outcomes and credibility where it fits the brand context.",
    defaultContentTypes: ["TEXT_POST", "CAROUSEL", "ARTICLE", "POLL"],
  },
  {
    id: "instagram",
    label: "Instagram",
    purpose: "Visual brand, Reels/Stories, community, lifestyle, behind-the-scenes.",
    tone: "Warm, visual-first; short lines; emoji sparingly if it fits brand; strong hook in first line.",
    suggestedFormats: ["REEL", "CAROUSEL", "STORY", "FEED_POST"],
    aiGuidance:
      "Optimize for Instagram: punchy first line, visual cues in caption, clear CTA (save/share/comment/DM). Suggest Reels hooks and on-screen text ideas where relevant. Hashtags: 5-12 mix of niche + broad.",
    defaultContentTypes: ["REEL", "CAROUSEL", "STORY", "FEED_POST"],
  },
  {
    id: "facebook",
    label: "Facebook",
    purpose: "Local community, events, groups, longer explanations, mixed demographics.",
    tone: "Conversational, clear; can be slightly longer; event/date details welcome.",
    suggestedFormats: ["FEED_POST", "EVENT", "PHOTO_ALBUM", "SHORT_VIDEO"],
    aiGuidance:
      "Optimize for Facebook: community-friendly tone, event details when relevant, questions to drive comments. Hashtags optional and lighter than Instagram.",
    defaultContentTypes: ["FEED_POST", "EVENT", "SHORT_VIDEO"],
  },
  {
    id: "x",
    label: "X (Twitter)",
    purpose: "Newsy takes, threads, quick tips, public conversation.",
    tone: "Direct, concise; threads numbered; strong opener; one idea per post when not threading.",
    suggestedFormats: ["POST", "THREAD", "POLL"],
    aiGuidance:
      "Optimize for X: tight lines, thread structure if needed (1/n), hooks first. Respect character-style brevity in ideas. Hashtags: 1-2 if useful.",
    defaultContentTypes: ["THREAD", "POST", "POLL"],
  },
  {
    id: "youtube",
    label: "YouTube",
    purpose: "Long-form video, Shorts, education, tutorials, authority building.",
    tone: "Clear teaching voice; title + thumbnail angle; chapters and retention hooks.",
    suggestedFormats: ["LONG_VIDEO", "SHORT", "COMMUNITY_POST"],
    aiGuidance:
      "Optimize for YouTube: title ideas, hook in first 30s, outline beats, CTA (subscribe/comment/next video). For Shorts: pattern-interrupt hook, on-screen text beats.",
    defaultContentTypes: ["VIDEO_SCRIPT", "SHORT", "COMMUNITY_POST"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    purpose: "Short video trends, entertainment, rapid hooks, discovery.",
    tone: "Fast, casual, trend-aware; pattern interrupt in first 1-2 seconds verbally.",
    suggestedFormats: ["SHORT_VIDEO", "SERIES"],
    aiGuidance:
      "Optimize for TikTok: hook + beat sheet, on-screen text suggestions, sound/trend placeholders only if brand-appropriate. Keep ideas short and visual.",
    defaultContentTypes: ["SHORT_VIDEO"],
  },
  {
    id: "threads",
    label: "Threads",
    purpose: "Casual public conversation, Instagram-adjacent audience.",
    tone: "Conversational, low-friction; short paragraphs; authentic.",
    suggestedFormats: ["POST", "THREAD"],
    aiGuidance:
      "Optimize for Threads: informal but on-brand; short posts; optional light threading.",
    defaultContentTypes: ["POST", "THREAD"],
  },
  {
    id: "custom",
    label: "Custom",
    purpose: "You define the channel label and positioning; AI uses your text below.",
    tone: "Match the brand brief and any custom channel label you provide.",
    suggestedFormats: ["TEXT_POST", "VIDEO", "CAROUSEL"],
    aiGuidance:
      "Use the organization brand context and the custom channel label; pick formats that fit that label.",
    defaultContentTypes: ["TEXT_POST"],
  },
];

const PRESET_BY_ID = new Map(CONTENT_PLATFORM_PRESETS.map((p) => [p.id, p]));

export function getContentPlatformPreset(id: string | null | undefined): ContentPlatformPreset | null {
  if (!id) return null;
  return PRESET_BY_ID.get(id as ContentPlatformPresetId) ?? null;
}

/** Text block appended to AI prompts for this board. */
export function formatPlatformPresetForPrompt(preset: ContentPlatformPreset | null, contentChannelFallback: string): string {
  if (!preset) {
    return [
      "Platform (from channel label only):",
      contentChannelFallback,
      "Use sensible formats for that label.",
    ].join("\n");
  }
  return [
    `Platform preset: ${preset.label}`,
    `Purpose: ${preset.purpose}`,
    `Tone: ${preset.tone}`,
    `Typical formats: ${preset.suggestedFormats.join(", ")}`,
    `Platform rules: ${preset.aiGuidance}`,
    preset.id === "custom" && contentChannelFallback
      ? `Custom channel label: ${contentChannelFallback}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function guessContentTypeFromPreset(preset: ContentPlatformPreset | null, platformLabelLower: string): string {
  if (preset?.defaultContentTypes?.length) return preset.defaultContentTypes[0]!;
  const l = platformLabelLower;
  if (l.includes("linkedin")) return "TEXT_POST";
  if (l.includes("instagram")) return "REEL";
  if (l.includes("facebook")) return "FEED_POST";
  if (l.includes("x") || l.includes("twitter")) return "THREAD";
  if (l.includes("youtube")) return "VIDEO_SCRIPT";
  if (l.includes("tiktok")) return "SHORT_VIDEO";
  return "TEXT_POST";
}

export function isValidPresetId(id: string): id is ContentPlatformPresetId {
  return CONTENT_PLATFORM_PRESET_IDS.includes(id as ContentPlatformPresetId);
}
