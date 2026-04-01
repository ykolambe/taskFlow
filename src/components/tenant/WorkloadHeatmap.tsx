"use client";

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import { BarChart3, AlertTriangle, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { TeamWorkloadRow } from "@/lib/subtreeWorkload";
import type { User } from "@/types";
import toast from "react-hot-toast";

function primaryManagerId(u: User): string | null {
  const rel = u.reportingLinksAsSubordinate;
  if (!rel?.length) return null;
  const sorted = [...rel].sort((a, b) => a.sortOrder - b.sortOrder || a.managerId.localeCompare(b.managerId));
  return sorted[0].managerId;
}

function hasPrimaryDirectReport(users: User[], managerId: string): boolean {
  return users.some((u) => primaryManagerId(u) === managerId);
}

function heatStyle(value: number, max: number, scheme: "active" | "overdue" | "urgent"): CSSProperties {
  const m = Math.max(max, 1);
  const t = Math.min(value / m, 1);
  if (scheme === "overdue") {
    return {
      backgroundColor: `rgba(239, 68, 68, ${0.08 + t * 0.55})`,
      color: t > 0.35 ? "rgb(254 226 226)" : "rgb(148 163 184)",
    };
  }
  if (scheme === "urgent") {
    return {
      backgroundColor: `rgba(245, 158, 11, ${0.08 + t * 0.5})`,
      color: t > 0.35 ? "rgb(254 243 199)" : "rgb(148 163 184)",
    };
  }
  const r = Math.round(52 + t * (220 - 52));
  const g = Math.round(211 - t * (211 - 80));
  const b = Math.round(145 - t * (145 - 80));
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${0.15 + t * 0.45})`,
    color: t > 0.55 ? "rgb(254 226 226)" : "rgb(226 232 240)",
  };
}

interface Props {
  slug: string;
  viewerUserId: string;
  users: User[];
  initialRows: TeamWorkloadRow[];
}

export default function WorkloadHeatmap({ slug, viewerUserId, users, initialRows }: Props) {
  const [rows, setRows] = useState<TeamWorkloadRow[]>(initialRows);
  const [stack, setStack] = useState<{ id: string; label: string }[]>([{ id: viewerUserId, label: "My direct reports" }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const fetchForRoot = useCallback(
    async (rootUserId: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/t/${slug}/workload?rootUserId=${encodeURIComponent(rootUserId)}`);
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to load workload");
          return;
        }
        setRows(data.data.rows);
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  const hasReports = useCallback(
    (userId: string) => hasPrimaryDirectReport(users, userId),
    [users]
  );

  const maxActive = useMemo(() => Math.max(1, ...rows.map((r) => r.active)), [rows]);
  const maxOverdue = useMemo(() => Math.max(1, ...rows.map((r) => r.overdue)), [rows]);
  const maxUrgent = useMemo(() => Math.max(1, ...rows.map((r) => r.urgent)), [rows]);

  const drillInto = async (row: TeamWorkloadRow) => {
    if (!hasReports(row.userId)) {
      toast("No direct reports — nothing to drill into.");
      return;
    }
    setStack((s) => [...s, { id: row.userId, label: `${row.firstName} ${row.lastName}` }]);
    await fetchForRoot(row.userId);
  };

  const goBack = async () => {
    if (stack.length <= 1) return;
    const next = stack.slice(0, -1);
    const parent = next[next.length - 1];
    setStack(next);
    if (parent.id === viewerUserId) {
      setRows(initialRows);
      return;
    }
    await fetchForRoot(parent.id);
  };

  if (initialRows.length === 0 && stack.length === 1) {
    return (
      <p className="text-xs text-surface-600 mb-5 -mt-2">
        No direct reports yet — when someone reports to you, their row appears here. Click a person who has direct
        reports to see that level&apos;s heatmap.
      </p>
    );
  }

  const avg = rows[0]?.teamAvgActive ?? 0;

  return (
    <div className="mb-6 rounded-2xl border border-surface-700/80 bg-surface-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-800 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-surface-100">Workload heatmap</h2>
            <p className="text-[11px] text-surface-500 mt-0.5">
              One row per direct report in this view. Team average{" "}
              <span className="text-surface-300 font-medium">{avg}</span> active tasks per person.{" "}
              <span className="text-surface-600">Click a row to open that person&apos;s direct reports.</span>
            </p>
          </div>
        </div>
        {stack.length > 1 && (
          <button
            type="button"
            onClick={() => goBack()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-400 hover:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15 border border-primary-500/25 rounded-lg px-3 py-1.5 transition-colors shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
        )}
      </div>

      <div className="px-4 py-2 border-b border-surface-800/80">
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-surface-500">
          {stack.map((s, i) => (
            <span key={s.id + String(i)} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-surface-600" />}
              <span className={cn(i === stack.length - 1 ? "text-surface-200 font-medium" : "text-surface-500")}>
                {s.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="relative overflow-x-auto">
        {loading && (
          <div className="absolute inset-0 z-10 bg-surface-950/40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
          </div>
        )}
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-surface-500">No direct reports in this scope.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-surface-500 border-b border-surface-800">
                <th className="text-left py-2.5 pl-4 pr-2 font-medium">Person</th>
                <th className="text-center px-1 py-2.5 font-medium w-20">Active</th>
                <th className="text-center px-1 py-2.5 font-medium w-20">Overdue</th>
                <th className="text-center px-1 py-2.5 font-medium w-20">Urgent</th>
                <th className="text-left py-2.5 pl-2 pr-4 font-medium min-w-[100px]">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const canDrill = hasReports(row.userId);
                return (
                  <tr
                    key={row.userId}
                    role="button"
                    tabIndex={0}
                    onClick={() => drillInto(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        drillInto(row);
                      }
                    }}
                    className={cn(
                      "border-b border-surface-800/80 transition-colors",
                      canDrill && "cursor-pointer hover:bg-surface-800/80",
                      !canDrill && "cursor-default opacity-95",
                      row.isBottleneck && "bg-amber-500/[0.06]"
                    )}
                  >
                    <td className="py-2.5 pl-4 pr-2">
                      <div className="flex items-center gap-2">
                        <Avatar firstName={row.firstName} lastName={row.lastName} avatarUrl={row.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-surface-100 truncate">
                              {row.firstName} {row.lastName}
                            </span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: row.roleLevel.color + "22",
                                color: row.roleLevel.color,
                              }}
                            >
                              {row.roleLevel.name}
                            </span>
                            {row.isBottleneck && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                High vs avg
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-surface-600 mt-0.5">
                            {canDrill ? "Click to view their direct reports" : "No direct reports"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-1 text-center">
                      <span
                        className="inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-1.5 font-semibold tabular-nums"
                        style={heatStyle(row.active, maxActive, "active")}
                      >
                        {row.active}
                      </span>
                    </td>
                    <td className="px-1 text-center">
                      <span
                        className="inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-1.5 font-semibold tabular-nums"
                        style={heatStyle(row.overdue, maxOverdue, "overdue")}
                      >
                        {row.overdue}
                      </span>
                    </td>
                    <td className="px-1 text-center">
                      <span
                        className="inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-1.5 font-semibold tabular-nums"
                        style={heatStyle(row.urgent, maxUrgent, "urgent")}
                      >
                        {row.urgent}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-surface-800 overflow-hidden min-w-[48px]">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              row.isBottleneck ? "bg-amber-500/80" : "bg-primary-500/70"
                            )}
                            style={{ width: `${Math.max(row.loadShare * 100, row.active > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                        {canDrill && <ChevronRight className="w-4 h-4 text-surface-600 flex-shrink-0" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-4 py-2 border-t border-surface-800/80 flex flex-wrap gap-4 text-[10px] text-surface-600">
        <span>
          <span className="inline-block w-3 h-3 rounded mr-1 align-middle" style={{ background: "rgba(52, 211, 153, 0.35)" }} />
          Active: low to high load
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded mr-1 align-middle" style={{ background: "rgba(239, 68, 68, 0.35)" }} />
          Overdue
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded mr-1 align-middle" style={{ background: "rgba(245, 158, 11, 0.35)" }} />
          High / urgent priority
        </span>
      </div>
    </div>
  );
}
