"use client";

import { BarChart3 } from "lucide-react";

const PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
const PRIORITY_LABEL: Record<(typeof PRIORITY_ORDER)[number], string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};
const PRIORITY_COLOR: Record<(typeof PRIORITY_ORDER)[number], string> = {
  URGENT: "rgba(239, 68, 68, 0.85)",
  HIGH: "rgba(245, 158, 11, 0.85)",
  MEDIUM: "rgba(59, 130, 246, 0.85)",
  LOW: "rgba(100, 116, 139, 0.85)",
};

export interface PriorityCount {
  priority: string;
  count: number;
}

function normalizeSlices(rows: PriorityCount[]): { priority: (typeof PRIORITY_ORDER)[number]; count: number }[] {
  const map = new Map(rows.map((r) => [r.priority, r.count]));
  return PRIORITY_ORDER.map((p) => ({ priority: p, count: map.get(p) ?? 0 }));
}

function BarBlock({ title, subtitle, slices }: { title: string; subtitle: string; slices: ReturnType<typeof normalizeSlices> }) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  const max = Math.max(1, ...slices.map((x) => x.count));

  return (
    <div className="rounded-xl bg-surface-900/50 border border-surface-700/80 p-4">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-surface-100">{title}</h3>
      </div>
      <p className="text-[11px] text-surface-500 mb-3">{subtitle}</p>
      {total === 0 ? (
        <p className="text-xs text-surface-600 py-4 text-center">No open tasks in this view.</p>
      ) : (
        <div className="space-y-2.5">
          {slices.map(({ priority, count }) => (
            <div key={priority}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-surface-400">{PRIORITY_LABEL[priority]}</span>
                <span className="tabular-nums text-surface-200 font-medium">{count}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max((count / max) * 100, count > 0 ? 8 : 0)}%`,
                    background: PRIORITY_COLOR[priority],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  myByPriority: PriorityCount[];
  teamByPriority: PriorityCount[];
}

export default function DashboardCharts({ myByPriority, teamByPriority }: Props) {
  const mySlices = normalizeSlices(myByPriority);
  const teamSlices = normalizeSlices(teamByPriority);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <BarBlock title="My work by priority" subtitle="Open tasks assigned to you" slices={mySlices} />
      <BarBlock title="Team work by priority" subtitle="Open tasks in your org subtree (excluding you)" slices={teamSlices} />
    </div>
  );
}
