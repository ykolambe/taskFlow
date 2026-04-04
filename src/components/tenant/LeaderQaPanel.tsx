"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  Send,
  Loader2,
  Info,
  X,
  Sparkles,
  SquarePen,
  History,
  Trash2,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import {
  LEADER_GPT_STORAGE_VERSION,
  loadLeaderGptState,
  saveLeaderGptState,
} from "@/lib/leaderGptStorage";

interface MetricRow {
  key: string;
  label: string;
  value: number | string;
  window: string;
}

type SkippedReason = "ambiguous" | "not_found" | "no_permission" | "invalid_selector" | "no_permission_on_confirm";

interface SkippedRow {
  requested: string;
  reason: SkippedReason;
  candidates?: Array<{ id: string; name: string; email: string }>;
}

interface QaPayload {
  mode: "qa" | "task_proposal" | "clarification" | "bulk_create_preview" | "bulk_create_result";
  result?: {
    answer: string;
    topDrivers: string[];
    actions: string[];
    confidence: "LOW" | "MEDIUM" | "HIGH";
    citations: string[];
    metrics: MetricRow[];
  };
  source?: "ai" | "fallback";
  generatedAt?: string;
  message?: string;
  candidates?: Array<{ id: string; name: string; email: string }>;
  proposal?: {
    title: string;
    description: string;
    assigneeId: string;
    assigneeName: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate: string | null;
    acceptanceCriteria: string[];
  };
  planId?: string;
  specHash?: string;
  count?: number;
  warnings?: string[];
  requiresSecondConfirmation?: boolean;
  skipped?: SkippedRow[];
  drafts?: Array<{
    title: string;
    assigneeId: string;
    assigneeName: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate: string | null;
  }>;
  summary?: { requested: number; created: number; skipped: number };
}

function reasonLabel(reason: SkippedReason): string {
  if (reason === "ambiguous") return "Ambiguous target";
  if (reason === "not_found") return "Not found";
  if (reason === "no_permission") return "No permission";
  if (reason === "no_permission_on_confirm") return "Permission changed";
  return "Invalid selector";
}

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export type LeaderQaPanelVariant = "fab" | "inline";

export interface LeaderQaPanelProps {
  slug: string;
  /** Required for per-user persisted chats in this browser. */
  userId: string;
  variant: LeaderQaPanelVariant;
  onClose?: () => void;
}

type AssistantMsg =
  | { id: string; role: "assistant"; payload: QaPayload }
  | { id: string; role: "assistant"; plainText: string };

type MsgTurn = { id: string; role: "user"; text: string } | AssistantMsg;

type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: MsgTurn[];
};

type ChatState = {
  sessions: ChatSession[];
  activeSessionId: string;
};

function titleFromMessages(msgs: MsgTurn[]): string {
  const u = msgs.find((m) => m.role === "user");
  if (u && u.role === "user") {
    const t = u.text.trim();
    if (!t) return "New chat";
    return t.length > 48 ? `${t.slice(0, 46)}…` : t;
  }
  return "New chat";
}

/** ChatGPT-style reveal for the main assistant text (client-side; API still returns full JSON). */
function StreamingText({
  text,
  onComplete,
  onProgress,
  className,
}: {
  text: string;
  onComplete: () => void;
  onProgress?: () => void;
  className?: string;
}) {
  const [shown, setShown] = useState("");
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);
  onCompleteRef.current = onComplete;
  onProgressRef.current = onProgress;

  useEffect(() => {
    setShown("");
    if (!text) {
      onCompleteRef.current();
      return;
    }
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const len = text.length;
      const step = len > 1600 ? 8 : len > 600 ? 4 : len > 120 ? 2 : 1;
      i = Math.min(len, i + step);
      setShown(text.slice(0, i));
      onProgressRef.current?.();
      if (i < len) {
        window.setTimeout(tick, 13);
      } else {
        onCompleteRef.current();
      }
    };
    const start = window.setTimeout(tick, 48);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [text]);

  const cursor =
    shown.length < text.length ? (
      <span
        className="inline-block w-[3px] h-[1.05em] ml-0.5 bg-primary-500/85 dark:bg-primary-400/90 align-middle rounded-sm animate-pulse"
        aria-hidden
      />
    ) : null;

  return (
    <p className={className}>
      {shown}
      {cursor}
    </p>
  );
}

export default function LeaderQaPanel({ slug, userId, variant, onClose }: LeaderQaPanelProps) {
  const [chatState, setChatState] = useState<ChatState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [bulkSecondConfirm, setBulkSecondConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Assistant message id currently revealing with typewriter (only for freshly received replies). */
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyPopoverRef = useRef<HTMLDivElement>(null);

  const isFab = variant === "fab";

  const messages = useMemo(() => {
    if (!chatState) return [];
    return chatState.sessions.find((s) => s.id === chatState.activeSessionId)?.messages ?? [];
  }, [chatState]);

  useEffect(() => {
    const loaded = loadLeaderGptState(slug, userId);
    if (!loaded || loaded.sessions.length === 0) {
      const id = newId();
      setChatState({
        sessions: [{ id, title: "New chat", messages: [], updatedAt: new Date().toISOString() }],
        activeSessionId: id,
      });
    } else {
      setChatState({
        sessions: loaded.sessions.map((s) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updatedAt,
          messages: (s.messages as MsgTurn[]) ?? [],
        })),
        activeSessionId: loaded.activeSessionId,
      });
    }
    setHydrated(true);
  }, [slug, userId]);

  useEffect(() => {
    if (!hydrated || !chatState) return;
    saveLeaderGptState(slug, userId, {
      v: LEADER_GPT_STORAGE_VERSION,
      sessions: chatState.sessions.map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        messages: s.messages as unknown[],
      })),
      activeSessionId: chatState.activeSessionId,
    });
  }, [chatState, hydrated, slug, userId]);

  useEffect(() => {
    if (!historyOpen) return;
    const fn = (e: globalThis.MouseEvent) => {
      if (historyPopoverRef.current && !historyPopoverRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [historyOpen]);

  const updateMessages = useCallback((fn: (prev: MsgTurn[]) => MsgTurn[]) => {
    setChatState((cs) => {
      if (!cs) return cs;
      const idx = cs.sessions.findIndex((s) => s.id === cs.activeSessionId);
      if (idx < 0) return cs;
      const nextMsg = fn(cs.sessions[idx].messages);
      const sessions = [...cs.sessions];
      sessions[idx] = {
        ...sessions[idx],
        messages: nextMsg,
        title: titleFromMessages(nextMsg),
        updatedAt: new Date().toISOString(),
      };
      return { ...cs, sessions };
    });
  }, []);

  const helpPrompts = [
    "Why is Team A slipping this week?",
    "Create weekly follow-up tasks for all direct reports with HIGH priority due next Friday",
    "Create onboarding checklist tasks for role supervisors",
    "Create tasks for Alex, Maria and Tom to submit Friday status updates",
  ];

  const lastAssistantPayload = useMemo((): QaPayload | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && "payload" in m) return m.payload;
    }
    return null;
  }, [messages]);

  const scrollThreadToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scrollThreadToEnd();
  }, [messages, loading, showHelp, scrollThreadToEnd]);

  const endAssistantStream = useCallback(() => {
    setStreamingMessageId(null);
  }, []);

  const startNewChat = () => {
    setBulkSecondConfirm(false);
    setShowHelp(false);
    setQuestion("");
    setChatState((cs) => {
      if (!cs) return cs;
      const cur = cs.sessions.find((s) => s.id === cs.activeSessionId);
      if (cur && cur.messages.length === 0) return cs;
      const newSid = newId();
      return {
        sessions: [
          ...cs.sessions,
          { id: newSid, title: "New chat", messages: [], updatedAt: new Date().toISOString() },
        ],
        activeSessionId: newSid,
      };
    });
    setSidebarOpen(false);
    setHistoryOpen(false);
    setStreamingMessageId(null);
  };

  const selectSession = (id: string) => {
    setBulkSecondConfirm(false);
    setChatState((cs) => (cs ? { ...cs, activeSessionId: id } : cs));
    setSidebarOpen(false);
    setHistoryOpen(false);
    setStreamingMessageId(null);
  };

  const removeSession = (id: string, e: ReactMouseEvent) => {
    e.stopPropagation();
    setChatState((cs) => {
      if (!cs) return cs;
      const next = cs.sessions.filter((s) => s.id !== id);
      if (next.length === 0) {
        const nid = newId();
        return {
          sessions: [{ id: nid, title: "New chat", messages: [], updatedAt: new Date().toISOString() }],
          activeSessionId: nid,
        };
      }
      let active = cs.activeSessionId;
      if (active === id) active = next[0].id;
      return { sessions: next, activeSessionId: active };
    });
  };

  const ask = async () => {
    if (!question.trim()) return;
    const trimmed = question.trim();
    setQuestion("");
    const userTurn: MsgTurn = { id: newId(), role: "user", text: trimmed };
    updateMessages((prev) => [...prev, userTurn]);
    setLoading(true);
    setBulkSecondConfirm(false);
    try {
      const res = await fetch(`/api/t/${slug}/ai/leader-qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ask", question: trimmed }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not get answer");
        updateMessages((prev) => prev.slice(0, -1));
        return;
      }
      const assistantId = newId();
      const payload = j.data as QaPayload;
      updateMessages((prev) => [...prev, { id: assistantId, role: "assistant", payload }]);
      const mode = payload?.mode;
      if (mode === "qa" || mode === "clarification") {
        setStreamingMessageId(assistantId);
      }
      if (j.data?.source === "fallback") {
        toast("Used fallback answer based on deterministic metrics.");
      }
    } finally {
      setLoading(false);
    }
  };

  const createFromProposal = async () => {
    if (!lastAssistantPayload?.proposal) return;
    setCreating(true);
    try {
      const p = lastAssistantPayload.proposal;
      const auditNote = "\n\n---\nCreated via AI chat assistant (confirmed by user).";
      const desc = [
        p.description,
        p.acceptanceCriteria.length ? `Acceptance criteria:\n- ${p.acceptanceCriteria.join("\n- ")}` : "",
        auditNote,
      ]
        .filter(Boolean)
        .join("\n\n");
      const res = await fetch(`/api/t/${slug}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: p.title,
          description: desc,
          assigneeId: p.assigneeId,
          priority: p.priority,
          dueDate: p.dueDate,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Failed to create task");
        return;
      }
      toast.success("Task created from AI proposal");
      const confirmId = newId();
      updateMessages((prev) => {
        const next = [...prev];
        const last = next.pop();
        if (last?.role === "assistant" && "payload" in last) {
          next.push({ id: confirmId, role: "assistant", plainText: "Task created from your proposal." });
        }
        return next;
      });
      setStreamingMessageId(confirmId);
    } finally {
      setCreating(false);
    }
  };

  const canConfirmBulk = useMemo(() => {
    if (!lastAssistantPayload || lastAssistantPayload.mode !== "bulk_create_preview") return false;
    if (!lastAssistantPayload.requiresSecondConfirmation) return true;
    return bulkSecondConfirm;
  }, [lastAssistantPayload, bulkSecondConfirm]);

  const confirmBulkCreate = async () => {
    if (!lastAssistantPayload?.planId || !lastAssistantPayload.specHash) return;
    if (lastAssistantPayload.requiresSecondConfirmation && !bulkSecondConfirm) {
      toast.error("Please complete second confirmation for this large batch.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/t/${slug}/ai/leader-qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_bulk_create",
          planId: lastAssistantPayload.planId,
          specHash: lastAssistantPayload.specHash,
          secondConfirm: lastAssistantPayload.requiresSecondConfirmation ? bulkSecondConfirm : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Failed to create bulk tasks");
        return;
      }
      if (j.data?.summary) {
        toast.success(`Bulk create done: ${j.data.summary.created} created`);
      }
      updateMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && "payload" in last) {
          next[next.length - 1] = { ...last, payload: j.data };
        }
        return next;
      });
      setBulkSecondConfirm(false);
    } finally {
      setCreating(false);
    }
  };

  const cancelBulk = () => {
    updateMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && "payload" in last && last.payload.mode === "bulk_create_preview") {
        return prev.slice(0, -2);
      }
      return prev;
    });
    setBulkSecondConfirm(false);
  };

  const sortedSessions = useMemo(() => {
    if (!chatState) return [];
    return [...chatState.sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [chatState]);

  const shell = isFab
    ? "w-[22rem] sm:w-[26rem] h-[70vh] rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl"
    : "flex-1 min-h-0 h-full w-full rounded-none border-0 bg-surface-950 dark:bg-[#13101c]";

  const proseMuted = isFab ? "text-surface-400" : "text-slate-500 dark:text-[#9ca0b8]";
  const proseBody = isFab ? "text-surface-100" : "text-slate-900 dark:text-[#e9edef]";
  const cardBg = isFab ? "bg-surface-800/80 border-surface-700" : "bg-white/80 border-slate-200/90 dark:bg-[#1c1828] dark:border-[#2a2538]";
  const chipClass = isFab
    ? "bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-600/80"
    : "bg-slate-100 hover:bg-slate-200/90 text-slate-800 border border-slate-200/90 dark:bg-[#2a2538] dark:hover:bg-[#36304a] dark:text-[#e9edef] dark:border-transparent";

  const sessionSidebarClass = cn(
    "flex flex-col border-r shrink-0 bg-slate-100/95 dark:bg-[#1a1626]",
    isFab ? "border-surface-800" : "border-slate-200/90 dark:border-[#2a2538]"
  );

  const renderSessionRows = (compact: boolean) => (
    <div className={cn("flex flex-col min-h-0 flex-1", compact ? "p-2" : "p-2 lg:p-3")}>
      <button
        type="button"
        onClick={() => {
          startNewChat();
        }}
        className={cn(
          "w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mb-2",
          "bg-primary-600 text-white hover:bg-primary-500",
          compact && "py-2 text-xs"
        )}
      >
        <SquarePen className="w-4 h-4 shrink-0" />
        New chat
      </button>
      <p className={cn("text-[0.625rem] font-semibold uppercase tracking-wide px-2 mb-1", proseMuted)}>
        Your conversations
      </p>
      <ul className="space-y-0.5 overflow-y-auto flex-1 min-h-0">
        {sortedSessions.map((s) => {
          const active = chatState!.activeSessionId === s.id;
          return (
            <li key={s.id} className="group flex items-stretch gap-0.5">
              <button
                type="button"
                onClick={() => selectSession(s.id)}
                className={cn(
                  "flex-1 min-w-0 text-left rounded-lg px-2.5 py-2 text-[0.8125rem] leading-snug transition-colors",
                  active
                    ? "bg-white dark:bg-[#2a2538] text-slate-900 dark:text-[#e9edef] shadow-sm ring-1 ring-slate-200/80 dark:ring-[#3d3558]"
                    : "text-slate-700 dark:text-[#c4c2d4] hover:bg-slate-200/80 dark:hover:bg-[#2a2538]/80"
                )}
              >
                <span className="line-clamp-2">{s.title}</span>
              </button>
              <button
                type="button"
                onClick={(e) => removeSession(s.id, e)}
                className={cn(
                  "shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity",
                  "text-slate-400 hover:text-red-500 hover:bg-red-500/10",
                  sortedSessions.length <= 1 && "invisible"
                )}
                title="Delete chat"
                aria-label="Delete chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (!hydrated || !chatState) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          isFab ? shell : "flex-1 min-h-0 h-full w-full bg-surface-950 dark:bg-[#13101c]"
        )}
      >
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" aria-label="Loading" />
      </div>
    );
  }

  const headerBar = (
    <header
      className={cn(
        "flex items-center justify-between gap-1.5 px-2 sm:px-4 py-2.5 border-b shrink-0",
        "pt-[max(0.25rem,env(safe-area-inset-top))] pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))]",
        isFab ? "border-surface-800 bg-surface-900/95" : "border-slate-200/90 bg-white/90 dark:border-[#2a2538] dark:bg-[#1c1828]/95 backdrop-blur-sm"
      )}
    >
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {!isFab && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl text-slate-700 hover:bg-slate-200/90 active:bg-slate-300/80 dark:text-[#e9edef] dark:hover:bg-[#2a2538]"
            aria-label="Back to team chats"
            title="Team chats"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        {!isFab && (
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className={cn(
              "shrink-0 p-2 rounded-xl transition-colors",
              sidebarOpen
                ? "text-primary-600 bg-primary-500/15 dark:text-primary-300 dark:bg-primary-500/15"
                : "text-slate-500 hover:bg-slate-200/80 dark:text-[#9ca0b8] dark:hover:bg-[#2a2538]"
            )}
            aria-label={sidebarOpen ? "Hide LeaderGPT conversations" : "LeaderGPT conversations"}
            title={sidebarOpen ? "Close conversation list" : "LeaderGPT chats"}
          >
            <History className="w-5 h-5" />
          </button>
        )}
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
            "bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm"
          )}
        >
          <Sparkles className="w-4 h-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold truncate leading-tight", proseBody)}>LeaderGPT</p>
          <p className={cn("text-[0.6875rem] truncate hidden sm:block", proseMuted)}>
            Leadership Q&amp;A &amp; task actions
          </p>
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {isFab && (
          <div ref={historyPopoverRef} className="relative">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                "text-surface-400 hover:bg-surface-800 hover:text-surface-100"
              )}
              title="Chat history"
              aria-label="Chat history"
              aria-expanded={historyOpen}
            >
              <History className="w-4 h-4" />
            </button>
            {historyOpen && (
              <div
                className={cn(
                  "absolute right-0 top-full z-[70] mt-1 w-[min(calc(100vw-2rem),16rem)] max-h-[min(60vh,320px)] overflow-hidden rounded-xl border shadow-xl",
                  "border-surface-700 bg-surface-900 flex flex-col"
                )}
              >
                {renderSessionRows(true)}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={startNewChat}
          className={cn(
            "p-2 rounded-lg transition-colors",
            isFab ? "text-surface-400 hover:bg-surface-800 hover:text-surface-100" : "text-slate-500 hover:bg-slate-200/80 dark:text-[#9ca0b8] dark:hover:bg-[#2a2538] dark:hover:text-[#e9edef]"
          )}
          title="New chat"
          aria-label="New chat"
        >
          <SquarePen className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className={cn(
            "p-2 rounded-lg transition-colors",
            isFab ? "text-surface-400 hover:bg-surface-800 hover:text-surface-100" : "text-slate-500 hover:bg-slate-200/80 dark:text-[#9ca0b8] dark:hover:bg-[#2a2538] dark:hover:text-[#e9edef]"
          )}
          title="Tips & example prompts"
          aria-label="Help"
        >
          <Info className="w-4 h-4" />
        </button>
        {onClose && isFab && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg transition-colors",
              "text-surface-400 hover:bg-surface-800 hover:text-surface-100"
            )}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );

  const threadAndComposer = (
    <>

      {/* Scrollable thread */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain",
          isFab ? "bg-surface-900" : "bg-slate-50/80 dark:bg-[#0f0d16]"
        )}
      >
        <div className={cn("mx-auto w-full max-w-[min(100%,42rem)] px-3 sm:px-4 py-6 space-y-5")}>
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center text-center pt-4 pb-2 px-2">
              <div
                className={cn(
                  "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
                  "bg-gradient-to-br from-primary-500/20 to-primary-700/30 text-primary-600 dark:text-primary-300 ring-1 ring-primary-500/20"
                )}
              >
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className={cn("text-lg font-medium tracking-tight", proseBody)}>How can I help you lead today?</h2>
              <p className={cn("text-sm mt-1.5 max-w-md leading-relaxed", proseMuted)}>
                Ask about workload and trends, or describe tasks to create for your team. Use clear scope (team, names,
                dates).
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                {helpPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQuestion(prompt)}
                    className={cn("text-left text-xs rounded-full px-3 py-2 transition-colors", chipClass)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <div
                    className={cn(
                      "max-w-[min(100%,85%)] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[0.9375rem] leading-relaxed shadow-sm",
                      "bg-primary-600 text-white",
                      "dark:bg-primary-700 dark:text-[#f4f4f5]"
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              );
            }
            if ("plainText" in m) {
              const streamPlain = streamingMessageId === m.id;
              return (
                <div key={m.id} className="flex justify-start">
                  <div
                    className={cn(
                      "max-w-[min(100%,85%)] rounded-2xl rounded-bl-md px-3.5 py-2.5 border",
                      cardBg,
                      proseBody
                    )}
                  >
                    {streamPlain ? (
                      <StreamingText
                        text={m.plainText}
                        onComplete={endAssistantStream}
                        onProgress={scrollThreadToEnd}
                        className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap"
                      />
                    ) : (
                      <span className="text-[0.9375rem] leading-relaxed">{m.plainText}</span>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[min(100%,92%)] w-full space-y-3">
                  <PayloadBlock
                    payload={m.payload}
                    messageId={m.id}
                    streamingMessageId={streamingMessageId}
                    onStreamComplete={endAssistantStream}
                    onStreamProgress={scrollThreadToEnd}
                    isFab={isFab}
                    interactive={isLast}
                    creating={creating}
                    bulkSecondConfirm={bulkSecondConfirm}
                    setBulkSecondConfirm={setBulkSecondConfirm}
                    onConfirmBulk={confirmBulkCreate}
                    onCancelBulk={cancelBulk}
                    onCreateFromProposal={createFromProposal}
                    canConfirmBulk={canConfirmBulk}
                    reasonLabel={reasonLabel}
                  />
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3 border",
                  cardBg,
                  proseMuted
                )}
              >
                <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                <span className="text-sm">Thinking…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer — fixed bottom, ChatGPT-style */}
      <div
        className={cn(
          "shrink-0 border-t px-3 sm:px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          isFab ? "border-surface-800 bg-surface-900" : "border-slate-200/90 bg-white/95 dark:border-[#2a2538] dark:bg-[#1c1828]/95 backdrop-blur-md"
        )}
      >
        <div className="mx-auto w-full max-w-[min(100%,42rem)]">
          {showHelp && (
            <div
              className={cn(
                "mb-2 rounded-xl border px-3 py-2 text-xs leading-relaxed",
                isFab ? "border-surface-700 bg-surface-800/60 text-surface-300" : "border-slate-200/90 bg-slate-50 dark:bg-[#13101c] dark:border-[#2a2538] dark:text-[#c4c2d4]"
              )}
            >
              <span className={proseMuted}>
                Better results: include scope (direct reports / team / role / names), clear title, priority, and due date.
              </span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {helpPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQuestion(prompt)}
                    className={cn("text-[0.6875rem] rounded-full px-2.5 py-1 transition-colors", chipClass)}
                  >
                    {prompt.slice(0, 42)}
                    {prompt.length > 42 ? "…" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className={cn(
              "relative flex items-end gap-2 rounded-2xl border shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:border-primary-500/40",
              isFab
                ? "border-surface-600 bg-surface-800/90"
                : "border-slate-200/90 bg-white dark:border-[#2a2538] dark:bg-[#2a2538]"
            )}
          >
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!loading && question.trim()) void ask();
                }
              }}
              placeholder="Message LeaderGPT…"
              rows={2}
              className={cn(
                "flex-1 min-h-[52px] max-h-40 resize-none bg-transparent px-3.5 py-3 text-[0.9375rem] leading-relaxed focus:outline-none rounded-2xl",
                isFab
                  ? "text-surface-100 placeholder:text-surface-500"
                  : "text-slate-900 placeholder:text-slate-400 dark:text-[#e9edef] dark:placeholder:text-[#9ca0b8]"
              )}
            />
            <div className="pr-1.5 pb-1.5">
              <button
                type="button"
                onClick={() => void ask()}
                disabled={loading || !question.trim()}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-colors shrink-0",
                  "bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-40 disabled:hover:bg-primary-600",
                  "shadow-sm"
                )}
                aria-label="Send message"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className={cn("text-[0.625rem] text-center mt-2", proseMuted)}>
            AI can make mistakes. Verify important actions before confirming.
          </p>
        </div>
      </div>
    </>
  );

  return isFab ? (
    <div className={cn("overflow-hidden flex flex-col min-h-0", shell)}>
      {headerBar}
      <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">{threadAndComposer}</div>
    </div>
  ) : (
    <div className="flex flex-1 min-h-0 h-full w-full flex-row overflow-hidden bg-surface-950 dark:bg-[#13101c]">
      {sidebarOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50"
            aria-label="Close LeaderGPT conversation list"
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            className={cn(
              "fixed left-0 top-0 z-50 h-full w-[min(85vw,280px)] flex flex-col shadow-2xl",
              "pt-[env(safe-area-inset-top)]",
              sessionSidebarClass
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3",
                "border-slate-200/90 dark:border-[#2a2538] bg-slate-100/95 dark:bg-[#1a1626]"
              )}
            >
              <p className={cn("text-sm font-semibold truncate", proseBody)}>LeaderGPT chats</p>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="shrink-0 p-2 rounded-xl text-slate-600 hover:bg-slate-200/90 dark:text-[#e9edef] dark:hover:bg-[#2a2538]"
                aria-label="Close conversation list"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderSessionRows(false)}</div>
          </aside>
        </>
      )}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {headerBar}
        {threadAndComposer}
      </div>
    </div>
  );
}

function PayloadBlock({
  payload,
  messageId,
  streamingMessageId,
  onStreamComplete,
  onStreamProgress,
  isFab,
  interactive,
  creating,
  bulkSecondConfirm,
  setBulkSecondConfirm,
  onConfirmBulk,
  onCancelBulk,
  onCreateFromProposal,
  canConfirmBulk,
  reasonLabel,
}: {
  payload: QaPayload;
  messageId: string;
  streamingMessageId: string | null;
  onStreamComplete: () => void;
  onStreamProgress?: () => void;
  isFab: boolean;
  interactive: boolean;
  creating: boolean;
  bulkSecondConfirm: boolean;
  setBulkSecondConfirm: (v: boolean) => void;
  onConfirmBulk: () => void;
  onCancelBulk: () => void;
  onCreateFromProposal: () => void;
  canConfirmBulk: boolean;
  reasonLabel: (r: SkippedReason) => string;
}) {
  const streamThis = streamingMessageId === messageId;
  const [metricsOpen, setMetricsOpen] = useState(false);
  const proseMuted = isFab ? "text-surface-400" : "text-slate-500 dark:text-[#9ca0b8]";
  const proseBody = isFab ? "text-surface-100" : "text-slate-900 dark:text-[#e9edef]";
  const cardBg = isFab ? "bg-surface-800/80 border-surface-700" : "bg-white/90 border-slate-200/90 dark:bg-[#1c1828] dark:border-[#2a2538]";
  const bubble = cn(
    "rounded-2xl rounded-bl-md border px-3.5 py-3 text-[0.9375rem] leading-relaxed shadow-sm",
    cardBg,
    proseBody
  );

  if (payload.mode === "clarification") {
    const msg = payload.message ?? "";
    if (streamThis && msg) {
      return (
        <div className={bubble}>
          <StreamingText
            text={msg}
            onComplete={onStreamComplete}
            onProgress={onStreamProgress}
            className={cn("text-sm", isFab ? "text-amber-300" : "text-amber-600 dark:text-amber-400")}
          />
        </div>
      );
    }
    return (
      <div className={bubble}>
        <p className={cn("text-sm", isFab ? "text-amber-300" : "text-amber-600 dark:text-amber-400")}>{payload.message}</p>
        {payload.candidates?.length ? (
          <ul className="mt-2 space-y-1">
            {payload.candidates.map((c) => (
              <li key={c.id} className={cn("text-xs", proseMuted)}>
                {c.name} ({c.email})
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (payload.mode === "bulk_create_preview") {
    return (
      <div className={cn(bubble, "space-y-3")}>
        <p className="text-sm font-semibold">Bulk create preview ({payload.count ?? 0} tasks)</p>
        {payload.warnings?.map((w, i) => (
          <p key={i} className={cn("text-xs", isFab ? "text-amber-300" : "text-amber-600 dark:text-amber-400")}>
            {w}
          </p>
        ))}
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {payload.drafts?.slice(0, 12).map((d, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl p-2 text-xs border",
                isFab ? "bg-surface-900/50 border-surface-700" : "bg-slate-50 border-slate-200/80 dark:bg-[#13101c] dark:border-transparent"
              )}
            >
              <p className="font-medium">{d.title}</p>
              <p className={proseMuted}>
                {d.assigneeName} · {d.priority}
                {d.dueDate ? ` · ${new Date(d.dueDate).toLocaleDateString()}` : ""}
              </p>
            </div>
          ))}
          {(payload.drafts?.length ?? 0) > 12 && (
            <p className={cn("text-[0.6875rem]", proseMuted)}>+ {(payload.drafts?.length ?? 0) - 12} more</p>
          )}
        </div>
        {(payload.skipped?.length ?? 0) > 0 && (
          <div className={cn("rounded-xl p-2 space-y-1 border", isFab ? "border-surface-700 bg-surface-900/40" : "border-slate-200/80 dark:border-transparent")}>
            <p className={cn("text-xs font-semibold", proseBody)}>Skipped ({payload.skipped?.length})</p>
            {payload.skipped?.slice(0, 8).map((s, i) => (
              <p key={i} className={cn("text-[0.6875rem]", proseMuted)}>
                {s.requested}: {reasonLabel(s.reason)}
              </p>
            ))}
          </div>
        )}
        {payload.requiresSecondConfirmation && interactive && (
          <label className={cn("flex items-center gap-2 text-xs", isFab ? "text-amber-300" : "text-amber-600 dark:text-amber-400")}>
            <input
              type="checkbox"
              checked={bulkSecondConfirm}
              onChange={(e) => setBulkSecondConfirm(e.target.checked)}
            />
            I reviewed this large batch and confirm creating all listed tasks.
          </label>
        )}
        {interactive && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onConfirmBulk}
              disabled={creating || !canConfirmBulk}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancelBulk}
              disabled={creating}
              className={cn(
                "inline-flex items-center justify-center rounded-xl disabled:opacity-50 text-sm font-semibold py-2",
                isFab ? "bg-surface-700 hover:bg-surface-600 text-surface-100" : "bg-slate-200/90 hover:bg-slate-200 text-slate-900 dark:bg-[#2a2538] dark:hover:bg-[#36304a] dark:text-[#e9edef]"
              )}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  if (payload.mode === "bulk_create_result" && payload.summary) {
    return (
      <div className={bubble}>
        <p className="font-semibold mb-1">Bulk create completed</p>
        <p className="text-sm">Requested: {payload.summary.requested}</p>
        <p className="text-sm">Created: {payload.summary.created}</p>
        <p className="text-sm">Skipped: {payload.summary.skipped}</p>
      </div>
    );
  }

  if (payload.mode === "task_proposal" && payload.proposal) {
    return (
      <div className={cn(bubble, "space-y-3")}>
        <p className="text-sm font-semibold">Task proposal</p>
        <div className={cn("rounded-xl p-2 text-xs space-y-1 border", isFab ? "border-surface-700" : "border-slate-200/80 dark:border-transparent")}>
          <p>
            <span className={proseMuted}>Title:</span> {payload.proposal.title}
          </p>
          <p>
            <span className={proseMuted}>Assignee:</span> {payload.proposal.assigneeName}
          </p>
          <p>
            <span className={proseMuted}>Priority:</span> {payload.proposal.priority}
          </p>
          <p>
            <span className={proseMuted}>Due:</span>{" "}
            {payload.proposal.dueDate ? new Date(payload.proposal.dueDate).toLocaleDateString() : "Not set"}
          </p>
        </div>
        {interactive && (
          <button
            type="button"
            onClick={onCreateFromProposal}
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Confirm &amp; create task
          </button>
        )}
      </div>
    );
  }

  if (payload.mode === "qa" && payload.result) {
    const answer = payload.result.answer ?? "";
    if (streamThis && answer) {
      return (
        <div className={cn(bubble, "space-y-4")}>
          <StreamingText
            text={answer}
            onComplete={onStreamComplete}
            onProgress={onStreamProgress}
            className={cn("whitespace-pre-wrap", proseBody)}
          />
        </div>
      );
    }
    return (
      <div className={cn(bubble, "space-y-4")}>
        <p className="whitespace-pre-wrap">{payload.result.answer}</p>
        <div>
          <p className={cn("text-[0.6875rem] uppercase tracking-wider mb-1 font-semibold", proseMuted)}>Top drivers</p>
          <ul className="space-y-1">
            {payload.result.topDrivers.map((d, i) => (
              <li key={i} className={cn("text-sm", isFab ? "text-surface-300" : "text-slate-600 dark:text-[#c4c2d4]")}>
                · {d}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={cn("text-[0.6875rem] uppercase tracking-wider mb-1 font-semibold", proseMuted)}>Actions</p>
          <ul className="space-y-1">
            {payload.result.actions.map((a, i) => (
              <li key={i} className={cn("text-sm", isFab ? "text-surface-300" : "text-slate-600 dark:text-[#c4c2d4]")}>
                · {a}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-slate-200/80 pt-3 mt-1 dark:border-surface-700/80">
          <button
            type="button"
            onClick={() => setMetricsOpen((v) => !v)}
            className="flex w-full items-center gap-2 text-left rounded-lg py-1 -mx-0.5 px-0.5 hover:bg-slate-100/80 dark:hover:bg-surface-800/60 transition-colors"
            aria-expanded={metricsOpen}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-slate-500 dark:text-surface-400 transition-transform duration-200",
                metricsOpen && "rotate-90"
              )}
              aria-hidden
            />
            <span className={cn("text-[0.6875rem] uppercase tracking-wider font-semibold", proseMuted)}>Cited metrics</span>
            <span className={cn("text-[0.625rem] font-normal normal-case tabular-nums", proseMuted)}>
              ({payload.result.metrics.length})
            </span>
          </button>
          {metricsOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {payload.result.metrics.map((m) => (
                <div
                  key={m.key}
                  className={cn(
                    "rounded-xl px-2.5 py-2 border text-sm",
                    isFab ? "bg-surface-900/50 border-surface-700" : "bg-slate-50 border-slate-200/80 dark:bg-[#13101c] dark:border-transparent"
                  )}
                >
                  <p className={cn("text-[0.625rem]", proseMuted)}>
                    {m.key} · {m.window}
                  </p>
                  <p className="font-medium">
                    {m.label}: {String(m.value)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(bubble, "text-sm")}>
      <p className={proseMuted}>Unsupported response format.</p>
    </div>
  );
}
