"use client";

import { useState, type ReactNode } from "react";
import { Sparkles, AlertTriangle, CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ExecutiveBriefResponse } from "@/lib/ai/types";
import toast from "react-hot-toast";

interface Props {
  slug: string;
}

function SectionTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-surface-400">{icon}</span>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">{label}</h3>
    </div>
  );
}

export default function ExecutiveBriefCard({ slug }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExecutiveBriefResponse | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/t/${slug}/ai/executive-brief`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not generate brief");
        return;
      }
      setData(j.data);
      toast.success(j.data?.source === "fallback" ? "Brief generated with fallback engine" : "Executive brief ready");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-cyan-500/10 via-surface-800 to-surface-800 border border-cyan-500/20 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <h2 className="font-semibold text-surface-100 text-sm tracking-tight">Executive AI Brief</h2>
          </div>
          <p className="text-xs text-surface-400 mt-1">
            On-demand leadership summary with risks, decisions, and next 7-day actions.
          </p>
        </div>
        <Button size="sm" onClick={generate} loading={loading}>
          {loading ? "Generating" : "Generate Brief"}
        </Button>
      </div>

      {data && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-surface-700/70 bg-surface-900/50 p-3">
            <p className="text-sm text-surface-100">{data.brief.summary}</p>
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full border",
                  data.brief.confidence === "HIGH"
                    ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                    : data.brief.confidence === "MEDIUM"
                    ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
                    : "text-red-300 border-red-500/30 bg-red-500/10"
                )}
              >
                Confidence: {data.brief.confidence}
              </span>
              <span className="text-surface-500">{new Date(data.generatedAt).toLocaleString()}</span>
              {data.source === "fallback" && <span className="text-amber-400">Fallback</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-surface-700/70 bg-surface-900/40 p-3">
              <SectionTitle icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="What changed" />
              <ul className="space-y-1.5">
                {data.brief.whatChanged.map((line, idx) => (
                  <li key={`${line}-${idx}`} className="text-xs text-surface-300">
                    - {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-surface-700/70 bg-surface-900/40 p-3">
              <SectionTitle icon={<ClipboardList className="w-3.5 h-3.5" />} label="Next 7 days" />
              <ul className="space-y-1.5">
                {data.brief.next7Days.map((line, idx) => (
                  <li key={`${line}-${idx}`} className="text-xs text-surface-300">
                    - {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-surface-700/70 bg-surface-900/40 p-3">
            <SectionTitle icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Top risks" />
            <div className="space-y-2">
              {data.brief.topRisks.map((r, idx) => (
                <div key={`${r.title}-${idx}`} className="text-xs">
                  <p className="text-surface-100 font-medium">
                    {r.title} <span className="text-surface-500">({r.severity})</span>
                  </p>
                  <p className="text-surface-400">{r.why}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-surface-700/70 bg-surface-900/40 p-3">
            <SectionTitle icon={<Sparkles className="w-3.5 h-3.5" />} label="Decisions needed" />
            <div className="space-y-2">
              {data.brief.decisionsNeeded.map((d, idx) => (
                <div key={`${d.decision}-${idx}`} className="text-xs">
                  <p className="text-surface-100 font-medium">{d.decision}</p>
                  <p className="text-surface-400">Impact: {d.impact}</p>
                  <p className="text-surface-500">Owner: {d.recommendedOwner}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-surface-500">{data.brief.sourceNote}</p>
        </div>
      )}
    </div>
  );
}
