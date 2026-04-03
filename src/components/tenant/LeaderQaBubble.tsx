"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

/**
 * Floating entry to Team Chat for all chat-enabled users.
 * AI-eligible users navigate with ?ai=1 so the LeaderGPT pane opens in chat.
 */
export default function LeaderQaBubble({
  slug,
  openWithLeaderGpt = false,
}: {
  slug: string;
  /** When true, opens `/chat?ai=1` (user has LeaderGPT / pinned row in chat). */
  openWithLeaderGpt?: boolean;
}) {
  const href = `/t/${slug}/chat${openWithLeaderGpt ? "?ai=1" : ""}`;

  return (
    <div className="fixed z-[60] right-4 sm:right-5 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-5">
      <Link
        href={href}
        className="w-12 h-12 rounded-full bg-primary-600 hover:bg-primary-500 text-white shadow-xl flex items-center justify-center transition-colors"
        title={openWithLeaderGpt ? "Team chat (LeaderGPT)" : "Team chat"}
        aria-label={openWithLeaderGpt ? "Open team chat with LeaderGPT" : "Open team chat"}
      >
        <MessageCircle className="w-5 h-5" />
      </Link>
    </div>
  );
}
