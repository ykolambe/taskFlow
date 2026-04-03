"use client";

import { useMemo, useState } from "react";
import { Send, Loader2, Info, X } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

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

export type LeaderQaPanelVariant = "fab" | "inline";

export interface LeaderQaPanelProps {
  slug: string;
  variant: LeaderQaPanelVariant;
  /** FAB: close button. Inline: optional (e.g. mobile back wired by parent). */
  onClose?: () => void;
}

export default function LeaderQaPanel({ slug, variant, onClose }: LeaderQaPanelProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<QaPayload | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkSecondConfirm, setBulkSecondConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const helpPrompts = [
    "Why is Team A slipping this week?",
    "Create weekly follow-up tasks for all direct reports with HIGH priority due next Friday",
    "Create onboarding checklist tasks for role supervisors",
    "Create tasks for Alex, Maria and Tom to submit Friday status updates",
  ];

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setBulkSecondConfirm(false);
    try {
      const res = await fetch(`/api/t/${slug}/ai/leader-qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ask", question: question.trim() }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not get answer");
        return;
      }
      setPayload(j.data);
      if (j.data?.source === "fallback") {
        toast("Used fallback answer based on deterministic metrics.");
      }
    } finally {
      setLoading(false);
    }
  };

  const createFromProposal = async () => {
    if (!payload?.proposal) return;
    setCreating(true);
    try {
      const p = payload.proposal;
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
      setPayload(null);
      setQuestion("");
    } finally {
      setCreating(false);
    }
  };

  const canConfirmBulk = useMemo(() => {
    if (!payload || payload.mode !== "bulk_create_preview") return false;
    if (!payload.requiresSecondConfirmation) return true;
    return bulkSecondConfirm;
  }, [payload, bulkSecondConfirm]);

  const confirmBulkCreate = async () => {
    if (!payload?.planId || !payload.specHash) return;
    if (payload.requiresSecondConfirmation && !bulkSecondConfirm) {
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
          planId: payload.planId,
          specHash: payload.specHash,
          secondConfirm: payload.requiresSecondConfirmation ? bulkSecondConfirm : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Failed to create bulk tasks");
        return;
      }
      setPayload(j.data);
      if (j.data?.summary) {
        toast.success(`Bulk create done: ${j.data.summary.created} created`);
      }
      setQuestion("");
      setBulkSecondConfirm(false);
    } finally {
      setCreating(false);
    }
  };

  const cancelBulk = () => {
    setPayload(null);
    setBulkSecondConfirm(false);
  };

  const isFab = variant === "fab";

  return (
    <div
      className={cn(
        "overflow-hidden flex flex-col shadow-2xl",
        isFab
          ? "w-[22rem] sm:w-[26rem] h-[70vh] rounded-2xl border border-surface-700 bg-surface-900"
          : "flex-1 min-h-0 h-full w-full rounded-none border-0 bg-surface-950 text-slate-900 dark:bg-[#13101c] dark:text-[#e9edef]"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b shrink-0",
          isFab ? "border-surface-800" : "border-slate-200/90 bg-surface-900 dark:border-[#2a2538] dark:bg-[#1c1828]"
        )}
      >
        <p className={cn("text-sm font-semibold", isFab ? "text-surface-100" : "text-slate-900 dark:text-[#e9edef]")}>LeaderGPT</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className={cn(
              isFab ? "text-surface-500 hover:text-surface-200" : "text-slate-500 hover:text-slate-800 dark:text-[#9ca0b8] dark:hover:text-[#e9edef]"
            )}
            title="LeaderGPT help"
          >
            <Info className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={cn(
                isFab ? "text-surface-500 hover:text-surface-200" : "text-slate-500 hover:text-slate-800 dark:text-[#9ca0b8] dark:hover:text-[#e9edef]"
              )}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className={cn("p-3 space-y-2 shrink-0", !isFab && "bg-surface-950 dark:bg-[#13101c]")}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder='Ask: "Why is Team A slipping?" or "Create weekly follow-up tasks for all supervisors"'
          rows={3}
          className={cn(
            "w-full rounded-xl px-3 py-2 text-sm focus:outline-none",
            isFab
              ? "bg-surface-800 border border-surface-700 text-surface-100 placeholder:text-surface-500 focus:border-primary-500"
              : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-primary-500 dark:bg-[#2a2538] dark:border-[#2a2538] dark:text-[#e9edef] dark:placeholder:text-[#9ca0b8]"
          )}
        />
        <button
          type="button"
          onClick={ask}
          disabled={loading || !question.trim()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-semibold py-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Ask
        </button>
        {showHelp && (
          <div
            className={cn(
              "rounded-xl border p-2",
              isFab ? "border-surface-700 bg-surface-800/60" : "border-slate-200/90 bg-surface-900 dark:border-[#2a2538] dark:bg-[#1c1828]"
            )}
          >
            <p className={cn("text-[11px]", isFab ? "text-surface-400" : "text-slate-500 dark:text-[#9ca0b8]")}>
              Better results: include scope (direct reports/team/role/names), clear title, priority, and due date.
            </p>
            <div className="space-y-1 mt-2">
              {helpPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQuestion(prompt)}
                  className={cn(
                    "w-full text-left text-[11px] rounded-lg px-2 py-1",
                    isFab
                      ? "bg-surface-700/60 hover:bg-surface-700 text-surface-300"
                      : "bg-slate-200/90 hover:bg-slate-200 text-slate-900 dark:bg-[#2a2538] dark:hover:bg-[#36304a] dark:text-[#e9edef]"
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {payload && (
        <div
          className={cn(
            "border-t p-3 space-y-3 overflow-y-auto flex-1 min-h-0",
            isFab ? "border-surface-800" : "border-slate-200/90 bg-surface-950 dark:border-[#2a2538] dark:bg-[#0f0d16]"
          )}
        >
          {payload.mode === "clarification" && (
            <>
              <p className={cn("text-sm", isFab ? "text-amber-300" : "text-amber-400")}>{payload.message}</p>
              {payload.candidates?.length ? (
                <div className="space-y-1">
                  {payload.candidates.map((c) => (
                    <p key={c.id} className={cn("text-xs", isFab ? "text-surface-300" : "text-slate-600 dark:text-[#c4c2d4]")}>
                      - {c.name} ({c.email})
                    </p>
                  ))}
                </div>
              ) : null}
            </>
          )}

          {payload.mode === "bulk_create_preview" && (
            <div className="space-y-2">
              <p className={cn("text-sm font-semibold", isFab ? "text-surface-100" : "text-slate-900 dark:text-[#e9edef]")}>
                Bulk create preview ({payload.count ?? 0} tasks)
              </p>
              {payload.warnings?.map((w, i) => (
                <p key={i} className={cn("text-xs", isFab ? "text-amber-300" : "text-amber-400")}>
                  - {w}
                </p>
              ))}

              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {payload.drafts?.slice(0, 12).map((d, i) => (
                  <div
                    key={i}
                    className={cn("rounded-lg p-2 text-xs", isFab ? "bg-surface-800 text-surface-300" : "bg-surface-900 text-slate-700 border border-slate-200/80 dark:bg-[#1c1828] dark:text-[#c4c2d4] dark:border-0")}
                  >
                    <p className={cn("font-medium", isFab ? "text-surface-100" : "text-slate-900 dark:text-[#e9edef]")}>{d.title}</p>
                    <p>
                      {d.assigneeName} · {d.priority}
                      {d.dueDate ? ` · ${new Date(d.dueDate).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                ))}
                {(payload.drafts?.length ?? 0) > 12 && (
                  <p className={cn("text-[11px]", isFab ? "text-surface-500" : "text-slate-500 dark:text-[#9ca0b8]")}>
                    + {(payload.drafts?.length ?? 0) - 12} more
                  </p>
                )}
              </div>

              {(payload.skipped?.length ?? 0) > 0 && (
                <div className={cn("rounded-lg p-2 space-y-1", isFab ? "bg-surface-800" : "bg-surface-900 border border-slate-200/80 dark:bg-[#1c1828] dark:border-0")}>
                  <p className={cn("text-xs font-semibold", isFab ? "text-surface-200" : "text-slate-900 dark:text-[#e9edef]")}>
                    Skipped ({payload.skipped?.length})
                  </p>
                  {payload.skipped?.slice(0, 8).map((s, i) => (
                    <p key={i} className={cn("text-[11px]", isFab ? "text-surface-400" : "text-slate-500 dark:text-[#9ca0b8]")}>
                      - {s.requested}: {reasonLabel(s.reason)}
                    </p>
                  ))}
                </div>
              )}

              {payload.requiresSecondConfirmation && (
                <label className={cn("flex items-center gap-2 text-xs", isFab ? "text-amber-300" : "text-amber-400")}>
                  <input
                    type="checkbox"
                    checked={bulkSecondConfirm}
                    onChange={(e) => setBulkSecondConfirm(e.target.checked)}
                  />
                  I reviewed this large batch and confirm creating all listed tasks.
                </label>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={confirmBulkCreate}
                  disabled={creating || !canConfirmBulk}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={cancelBulk}
                  disabled={creating}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl disabled:opacity-50 text-sm font-semibold py-2",
                    isFab
                      ? "bg-surface-700 hover:bg-surface-600 text-surface-100"
                      : "bg-slate-200/90 hover:bg-slate-200 text-slate-900 dark:bg-[#2a2538] dark:hover:bg-[#36304a] dark:text-[#e9edef]"
                  )}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {payload.mode === "bulk_create_result" && payload.summary && (
            <div
              className={cn(
                "rounded-lg p-3 text-sm space-y-1",
                isFab ? "bg-surface-800 text-surface-200" : "bg-surface-900 text-slate-800 border border-slate-200/80 dark:bg-[#1c1828] dark:text-[#e9edef] dark:border-0"
              )}
            >
              <p className="font-semibold">Bulk create completed</p>
              <p>Requested: {payload.summary.requested}</p>
              <p>Created: {payload.summary.created}</p>
              <p>Skipped: {payload.summary.skipped}</p>
            </div>
          )}

          {payload.mode === "task_proposal" && payload.proposal && (
            <div className="space-y-2">
              <p className={cn("text-sm font-semibold", isFab ? "text-surface-100" : "text-slate-900 dark:text-[#e9edef]")}>
                Task proposal (confirmation required)
              </p>
              <div
                className={cn(
                  "rounded-lg p-2 text-xs space-y-1",
                  isFab ? "bg-surface-800 text-surface-300" : "bg-surface-900 text-slate-700 border border-slate-200/80 dark:bg-[#1c1828] dark:text-[#c4c2d4] dark:border-0"
                )}
              >
                <p>
                  <span className={isFab ? "text-surface-500" : "text-slate-500 dark:text-[#9ca0b8]"}>Title:</span> {payload.proposal.title}
                </p>
                <p>
                  <span className={isFab ? "text-surface-500" : "text-slate-500 dark:text-[#9ca0b8]"}>Assignee:</span>{" "}
                  {payload.proposal.assigneeName}
                </p>
                <p>
                  <span className={isFab ? "text-surface-500" : "text-slate-500 dark:text-[#9ca0b8]"}>Priority:</span>{" "}
                  {payload.proposal.priority}
                </p>
                <p>
                  <span className={isFab ? "text-surface-500" : "text-slate-500 dark:text-[#9ca0b8]"}>Due:</span>{" "}
                  {payload.proposal.dueDate ? new Date(payload.proposal.dueDate).toLocaleDateString() : "Not set"}
                </p>
              </div>
              <button
                type="button"
                onClick={createFromProposal}
                disabled={creating}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Confirm & Create Task
              </button>
            </div>
          )}

          {payload.mode === "qa" && payload.result && (
            <>
              <p className={cn("text-sm", isFab ? "text-surface-100" : "text-slate-900 dark:text-[#e9edef]")}>{payload.result.answer}</p>
              <div>
                <p className={cn("text-[11px] uppercase tracking-wider mb-1", isFab ? "text-surface-500" : "text-slate-500 dark:text-[#9ca0b8]")}>
                  Top drivers
                </p>
                <ul className="space-y-1">
                  {payload.result.topDrivers.map((d, i) => (
                    <li key={i} className={cn("text-xs", isFab ? "text-surface-300" : "text-slate-600 dark:text-[#c4c2d4]")}>
                      - {d}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={cn("text-[11px] uppercase tracking-wider mb-1", isFab ? "text-surface-500" : "text-slate-500 dark:text-[#9ca0b8]")}>
                  Actions
                </p>
                <ul className="space-y-1">
                  {payload.result.actions.map((a, i) => (
                    <li key={i} className={cn("text-xs", isFab ? "text-surface-300" : "text-slate-600 dark:text-[#c4c2d4]")}>
                      - {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={cn("text-[11px] uppercase tracking-wider mb-1", isFab ? "text-surface-500" : "text-slate-500 dark:text-[#9ca0b8]")}>
                  Cited metrics
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {payload.result.metrics.map((m) => (
                    <div key={m.key} className={cn("rounded-lg px-2 py-1.5", isFab ? "bg-surface-800" : "bg-surface-900 border border-slate-200/80 dark:bg-[#1c1828] dark:border-0")}>
                      <p className={cn("text-[10px]", isFab ? "text-surface-500" : "text-slate-500 dark:text-[#9ca0b8]")}>
                        {m.key} · {m.window}
                      </p>
                      <p className={cn("text-xs font-medium", isFab ? "text-surface-200" : "text-slate-900 dark:text-[#e9edef]")}>
                        {m.label}: {String(m.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
