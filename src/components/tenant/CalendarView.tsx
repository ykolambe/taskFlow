"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Calendar, RotateCcw, AlertCircle, Plus, Target, Flag, Check, Trash2, X,
  FileText,
} from "lucide-react";
import { TenantTokenPayload } from "@/lib/auth";
import { Task, RecurringTask, CalendarCollection, CalendarEntry } from "@/types";
import { cn, isOverdue, PRIORITY_DOT_COLORS, DAY_NAMES } from "@/lib/utils";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, getDay, addMonths, subMonths,
} from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  type: "task" | "recurring" | "goal" | "content";
  status?: string;
  priority?: string;
  color?: string;
  taskId?: string;
  calendarId?: string;
  notes?: string;
  kind?: "GOAL" | "MILESTONE" | "CONTENT";
  contentStatus?: string;
  isDone?: boolean;
  isOverdue?: boolean;
  isMyTask?: boolean;
}

interface DayEvents {
  [dateKey: string]: CalendarEvent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Generate all dates in the current month view where a recurring task fires */
function getRecurringDatesInMonth(
  rt: RecurringTask,
  year: number,
  month: number // 0-indexed
): Date[] {
  const dates: Date[] = [];
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const rtStart = new Date(rt.startDate);
  const rtEnd = rt.endDate ? new Date(rt.endDate) : null;

  if (rt.frequency === "DAILY") {
    const cur = new Date(start);
    while (cur <= end) {
      if (cur >= rtStart && (!rtEnd || cur <= rtEnd)) {
        dates.push(new Date(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (rt.frequency === "WEEKLY" && rt.daysOfWeek.length > 0) {
    const cur = new Date(start);
    while (cur <= end) {
      if (rt.daysOfWeek.includes(cur.getDay())) {
        if (cur >= rtStart && (!rtEnd || cur <= rtEnd)) {
          dates.push(new Date(cur));
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (rt.frequency === "MONTHLY" && rt.dayOfMonth) {
    const d = new Date(year, month, rt.dayOfMonth);
    if (d >= rtStart && d <= end && (!rtEnd || d <= rtEnd)) {
      dates.push(d);
    }
  }

  return dates;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  user: TenantTokenPayload;
  tasks: Task[];
  recurringTasks: RecurringTask[];
  calendars: CalendarCollection[];
  calendarEntries: CalendarEntry[];
  slug: string;
}

function calendarLabel(c: CalendarCollection): string {
  if (c.type === "ORG" && (c.name === "Org Calendar" || c.name === "Workspace")) return "Workspace";
  return c.name;
}

function calendarTypeLabel(type: CalendarCollection["type"]): string {
  if (type === "ORG") return "Shared";
  return "Personal";
}

export default function CalendarView({ user, tasks, recurringTasks, calendars, calendarEntries, slug }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedCalendarId, setSelectedCalendarId] = useState(
    () => calendars.find((c) => c.type === "ORG")?.id ?? calendars[0]?.id ?? ""
  );
  const [addCalendarOpen, setAddCalendarOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState("");
  const [newCalendarColor, setNewCalendarColor] = useState("#6366f1");
  const [newCalendarType, setNewCalendarType] = useState<"PERSONAL" | "ORG">("PERSONAL");
  const [creatingCalendar, setCreatingCalendar] = useState(false);
  const [createCalendarError, setCreateCalendarError] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [goalKind, setGoalKind] = useState<"GOAL" | "MILESTONE">("GOAL");
  const [goalDate, setGoalDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [deletingCalendarId, setDeletingCalendarId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (!calendars.length) return;
    if (!calendars.some((c) => c.id === selectedCalendarId)) {
      setSelectedCalendarId(calendars.find((c) => c.type === "ORG")?.id ?? calendars[0].id);
    }
  }, [calendars, selectedCalendarId]);

  useEffect(() => {
    if (!addCalendarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creatingCalendar) setAddCalendarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addCalendarOpen, creatingCalendar]);

  const calendarById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const selectedCalendar = calendarById.get(selectedCalendarId);
  const workspaceMode = selectedCalendar?.type === "ORG";
  const channelCalendar = selectedCalendar?.type === "CHANNEL";

  /** Workspace: full team workload. Personal calendars: only your tasks (no recurring on the grid). */
  const scopedTasks = useMemo(() => {
    if (workspaceMode) return tasks;
    return tasks.filter((t) => t.assigneeId === user.userId);
  }, [tasks, workspaceMode, user.userId]);

  const scopedRecurring = useMemo(() => {
    if (workspaceMode) return recurringTasks;
    return [];
  }, [recurringTasks, workspaceMode]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ── Build event map ──────────────────────────────────────────────────────

  const eventMap = useMemo<DayEvents>(() => {
    const map: DayEvents = {};

    const addEvent = (d: Date, ev: CalendarEvent) => {
      const k = dateKey(d);
      if (!map[k]) map[k] = [];
      map[k].push(ev);
    };

    // Tasks with due dates
    for (const task of scopedTasks) {
      if (!task.dueDate) continue;
      const d = new Date(task.dueDate);
      addEvent(d, {
        id: task.id,
        title: task.title,
        type: "task",
        status: task.status,
        priority: task.priority,
        isOverdue: isOverdue(task.dueDate) && task.status !== "COMPLETED",
        isMyTask: task.assigneeId === user.userId,
        taskId: task.id,
      });
    }

    // Recurring task occurrences (workspace only)
    for (const rt of scopedRecurring) {
      if (!rt.isActive) continue;
      const dates = getRecurringDatesInMonth(rt, year, month);
      for (const d of dates) {
        addEvent(d, {
          id: `${rt.id}-${dateKey(d)}`,
          title: rt.title,
          type: "recurring",
          priority: rt.priority,
          color: rt.assignee?.roleLevel?.color ?? "#8b5cf6",
        });
      }
    }

    // Goals / milestones / content — only for the focused calendar; color follows calendar (not stale entry color)
    for (const goal of calendarEntries) {
      if (goal.calendarId !== selectedCalendarId) continue;
      const cal = calendarById.get(goal.calendarId);
      const d = new Date(goal.startAt);
      if (goal.kind === "CONTENT") {
        addEvent(d, {
          id: goal.id,
          title: goal.title,
          type: "content",
          color: cal?.color ?? goal.color,
          calendarId: goal.calendarId,
          notes: goal.notes ?? undefined,
          kind: "CONTENT",
          contentStatus: goal.contentStatus ?? undefined,
          isDone: goal.isDone,
        });
      } else {
        addEvent(d, {
          id: goal.id,
          title: goal.title,
          type: "goal",
          color: cal?.color ?? goal.color,
          calendarId: goal.calendarId,
          notes: goal.notes ?? undefined,
          kind: goal.kind,
          isDone: goal.isDone,
        });
      }
    }

    return map;
  }, [
    scopedTasks,
    scopedRecurring,
    calendarEntries,
    selectedCalendarId,
    calendarById,
    year,
    month,
    user.userId,
  ]);

  // ── Calendar grid days ───────────────────────────────────────────────────

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start with days from previous month
  const startPad = getDay(monthStart); // 0 = Sunday
  const paddedDays: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...calDays,
  ];
  // Pad end to complete last row
  while (paddedDays.length % 7 !== 0) paddedDays.push(null);

  // ── Selected day events ──────────────────────────────────────────────────

  const selectedEvents = selectedDate ? (eventMap[dateKey(selectedDate)] ?? []) : [];
  const selectedTasks = selectedEvents.filter((e) => e.type === "task");
  const selectedRecurring = selectedEvents.filter((e) => e.type === "recurring");
  const selectedGoals = selectedEvents.filter((e) => e.type === "goal");
  const selectedContent = selectedEvents.filter((e) => e.type === "content");

  // ── Week view helpers ────────────────────────────────────────────────────

  const todayStart = new Date();
  todayStart.setDate(todayStart.getDate() - todayStart.getDay()); // Sunday of current week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  async function createCalendar() {
    if (!newCalendarName.trim()) return;
    setCreatingCalendar(true);
    setCreateCalendarError(null);
    try {
      const res = await fetch(`/api/t/${slug}/calendars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCalendarName.trim(), color: newCalendarColor, type: newCalendarType }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateCalendarError(typeof json?.error === "string" ? json.error : "Could not create calendar");
        return;
      }
      setAddCalendarOpen(false);
      setNewCalendarName("");
      setNewCalendarColor("#6366f1");
      setNewCalendarType("PERSONAL");
      window.location.reload();
    } finally {
      setCreatingCalendar(false);
    }
  }

  async function createGoal() {
    if (!selectedCalendarId || !goalTitle.trim() || !goalDate) return;
    const calColor = selectedCalendar?.color ?? "#22c55e";
    setCreatingGoal(true);
    try {
      await fetch(`/api/t/${slug}/calendars/${selectedCalendarId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goalTitle.trim(),
          notes: goalNotes.trim() || null,
          kind: goalKind,
          color: calColor,
          startAt: new Date(`${goalDate}T09:00:00`).toISOString(),
        }),
      });
      window.location.reload();
    } finally {
      setCreatingGoal(false);
    }
  }

  async function deleteCalendar(calendar: CalendarCollection) {
    if (calendar.type !== "PERSONAL" || calendar.ownerUserId !== user.userId) return;
    const ok = window.confirm(`Delete personal calendar "${calendar.name}"? This will also delete its goals and milestones.`);
    if (!ok) return;
    setDeletingCalendarId(calendar.id);
    try {
      await fetch(`/api/t/${slug}/calendars/${calendar.id}`, { method: "DELETE" });
      window.location.reload();
    } finally {
      setDeletingCalendarId(null);
    }
  }

  async function deleteGoalEntry(ev: CalendarEvent) {
    if (!ev.calendarId) return;
    const kindLabel =
      ev.type === "content"
        ? "Content"
        : ev.kind === "MILESTONE"
          ? "Milestone"
          : "Goal";
    const ok = window.confirm(`Delete "${ev.title}" (${kindLabel})?`);
    if (!ok) return;
    setDeletingEntryId(ev.id);
    try {
      await fetch(`/api/t/${slug}/calendars/${ev.calendarId}/entries/${ev.id}`, { method: "DELETE" });
      window.location.reload();
    } finally {
      setDeletingEntryId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            Calendar
          </h1>
          <p className="text-ui-muted text-sm mt-0.5">
            <span className="text-slate-800 dark:text-surface-300 font-medium">Workspace</span> shows team tasks, recurring work, and shared goals.{" "}
            <span className="text-slate-800 dark:text-surface-300 font-medium">Personal</span> shows only your tasks and that calendar&apos;s goals.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setCreateCalendarError(null);
              setAddCalendarOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-primary-600 hover:bg-primary-500 text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add calendar
          </button>
          <div className="flex bg-surface-800 border border-surface-700 rounded-xl p-1">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                  view === v ? "bg-primary-500 text-white" : "text-slate-600 hover:text-slate-900 dark:text-surface-400 dark:hover:text-surface-200"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Single-select calendar focus — color matches goals below */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-3 sm:p-4">
        <p className="text-[11px] font-semibold text-ui-subtle uppercase tracking-wider mb-2">Focus calendar</p>
        <div className="flex flex-wrap items-center gap-2">
          {calendars.map((c) => {
            const selected = c.id === selectedCalendarId;
            const canDelete = c.type === "PERSONAL" && c.ownerUserId === user.userId;
            return (
              <div
                key={c.id}
                className={cn(
                  "inline-flex items-center rounded-full text-xs border-2 transition-all",
                  selected
                    ? "shadow-md text-slate-900 dark:text-surface-50"
                    : "border-surface-600 text-slate-700 hover:text-slate-900 dark:text-surface-400 dark:hover:text-surface-200 hover:border-surface-500"
                )}
                style={
                  selected
                    ? {
                        backgroundColor: `${c.color}35`,
                        borderColor: c.color,
                      }
                    : undefined
                }
              >
                <button
                  type="button"
                  onClick={() => setSelectedCalendarId(c.id)}
                  className="inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-full font-medium"
                  title={`Show only goals on ${calendarLabel(c)}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white/20" style={{ backgroundColor: c.color }} />
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">{calendarLabel(c)}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md font-semibold",
                      selected
                        ? "bg-black/15 text-slate-900 dark:bg-black/25 dark:text-surface-100"
                        : "bg-slate-200/90 text-slate-700 dark:bg-surface-700 dark:text-surface-300"
                    )}
                  >
                    {calendarTypeLabel(c.type)}
                  </span>
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void deleteCalendar(c)}
                    disabled={deletingCalendarId === c.id}
                    className="pr-2 py-1.5 text-slate-500 hover:text-red-600 dark:text-surface-500 dark:hover:text-red-400 disabled:opacity-40"
                    title="Delete personal calendar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {selectedCalendar && (
          <p className="text-xs text-ui-muted mt-3">
            Goals use this calendar&apos;s color (
            <span className="inline-flex items-center gap-1 align-middle">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedCalendar.color }} />
              <span className="font-mono text-[11px] text-slate-800 dark:text-surface-200">{selectedCalendar.color}</span>
            </span>
            ).{" "}
            {channelCalendar ? (
              <>
                Channel calendars show content and your own tasks. Manage posts in{" "}
                <Link href={`/t/${slug}/content`} className="link-on-surface">
                  Content Studio
                </Link>
                .
              </>
            ) : workspaceMode ? (
              <>Team tasks and recurring schedules are included.</>
            ) : (
              <>Only tasks assigned to you are shown; switch to Workspace for the full team.</>
            )}
          </p>
        )}
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentDate((d) => subMonths(d, 1))}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-surface-750 dark:text-surface-400 dark:hover:text-surface-100 dark:hover:bg-surface-800 rounded-xl transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-surface-100">{format(currentDate, "MMMM yyyy")}</h2>
        <button
          type="button"
          onClick={() => setCurrentDate((d) => addMonths(d, 1))}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-surface-750 dark:text-surface-400 dark:hover:text-surface-100 dark:hover:bg-surface-800 rounded-xl transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Add goal — tied to focused calendar color (not used for channel calendars) */}
      {!channelCalendar && (
        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-surface-300 uppercase tracking-wide">
              Add goal / milestone
              {selectedCalendar ? (
                <span className="font-normal text-surface-500 normal-case ml-2">
                  on <span className="text-surface-300">{calendarLabel(selectedCalendar)}</span>
                </span>
              ) : null}
            </p>
            <div className="flex items-center gap-2 text-xs text-surface-500">
              <span>Preview</span>
              <span
                className="h-6 w-14 rounded-lg border border-surface-600 shadow-inner"
                style={{ backgroundColor: selectedCalendar?.color ?? "#22c55e" }}
              />
            </div>
          </div>
          <input
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={goalNotes}
            onChange={(e) => setGoalNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={goalKind}
              onChange={(e) => setGoalKind(e.target.value as "GOAL" | "MILESTONE")}
              className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs"
            >
              <option value="GOAL">Goal</option>
              <option value="MILESTONE">Milestone</option>
            </select>
            <input
              type="date"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
              className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => void createGoal()}
              disabled={creatingGoal || !goalTitle.trim() || !selectedCalendarId}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-colors"
              style={{ backgroundColor: selectedCalendar?.color ?? "#059669" }}
            >
              {creatingGoal ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {view === "month" ? (
        <div className="space-y-4">
          {/* Month grid */}
          <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden">
            {/* Day name headers */}
            <div className="grid grid-cols-7 border-b border-surface-700">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
                <div
                  key={name}
                  className="py-2.5 text-center text-[11px] font-semibold text-slate-600 dark:text-surface-500 uppercase tracking-wider"
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Weeks */}
            <div className="grid grid-cols-7">
              {paddedDays.map((day, idx) => {
                if (!day) {
                  return <div key={`pad-${idx}`} className="min-h-[72px] border-b border-r border-surface-700/50 bg-surface-850/30 last:border-r-0" />;
                }

                const key = dateKey(day);
                const events = eventMap[key] ?? [];
                const taskEvents = events.filter((e) => e.type === "task");
                const recurringEvents = events.filter((e) => e.type === "recurring");
                const goalEvents = events.filter((e) => e.type === "goal");
                const contentEvents = events.filter((e) => e.type === "content");
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const todayFlag = isToday(day);
                const overdueCount = taskEvents.filter((e) => e.isOverdue).length;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "min-h-[72px] p-1.5 text-left border-b border-r border-surface-700/50 transition-all hover:bg-surface-750 last:border-r-0",
                      isSelected && "bg-primary-500/10 border-primary-500/30",
                      !isCurrentMonth && "opacity-40"
                    )}
                  >
                    {/* Date number */}
                    <div className={cn(
                      "w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1 mx-auto",
                      todayFlag
                        ? "bg-primary-500 text-white"
                        : isSelected
                        ? "bg-primary-500/30 text-primary-800 dark:text-primary-300"
                        : "text-slate-800 dark:text-surface-300"
                    )}>
                      {format(day, "d")}
                    </div>

                    {/* Event dots — max 3 visible */}
                    <div className="space-y-0.5">
                      {taskEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            "text-[9px] font-medium px-1 py-0.5 rounded truncate leading-tight",
                            ev.isOverdue
                              ? "bg-red-500/20 text-red-700 dark:text-red-400"
                              : ev.isMyTask
                              ? "bg-primary-500/20 text-primary-900 dark:text-primary-400"
                              : "bg-slate-200/90 text-slate-800 dark:bg-surface-600 dark:text-surface-300"
                          )}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {recurringEvents.slice(0, 1).map((ev) => (
                        <div
                          key={ev.id}
                          className="text-[9px] font-medium px-1 py-0.5 rounded truncate leading-tight"
                          style={{ backgroundColor: (ev.color ?? "#8b5cf6") + "25", color: ev.color ?? "#8b5cf6" }}
                        >
                          ↺ {ev.title}
                        </div>
                      ))}
                      {goalEvents.slice(0, 1).map((ev) => (
                        <div key={ev.id} className="text-[9px] font-medium px-1 py-0.5 rounded truncate leading-tight" style={{ backgroundColor: (ev.color ?? "#22c55e") + "25", color: ev.color ?? "#22c55e" }}>
                          {ev.kind === "MILESTONE" ? "◆" : "◎"} {ev.title}
                        </div>
                      ))}
                      {contentEvents.slice(0, 1).map((ev) => (
                        <div
                          key={ev.id}
                          className="text-[9px] font-medium px-1 py-0.5 rounded truncate leading-tight border border-cyan-600/35 bg-cyan-500/15 text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200"
                        >
                          ▪ {ev.title}
                        </div>
                      ))}
                      {events.length > 3 && (
                        <p className="text-[9px] text-slate-600 dark:text-surface-500 px-1">
                          +{events.length - 3} more
                        </p>
                      )}
                    </div>

                    {/* Overdue warning dot */}
                    {overdueCount > 0 && (
                      <div className="mt-0.5 flex justify-end">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day panel */}
          {selectedDate && (
            <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-4 border-b border-surface-700 min-w-0">
                <h3 className="font-semibold text-surface-100 text-sm min-w-0">
                  {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE, MMMM d")}
                  <span className="ml-2 text-ui-muted font-normal text-xs">
                    {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
                  </span>
                </h3>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    href={`/t/${slug}/tasks?new=1&due=${format(selectedDate, "yyyy-MM-dd")}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold px-3 py-2 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New task (due this day)
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
                    className="text-xs link-on-surface transition-colors px-2 py-1.5"
                  >
                    Today
                  </button>
                </div>
              </div>

              {selectedEvents.length === 0 ? (
                <div className="py-10 text-center text-ui-muted text-sm">
                  No events on this day
                </div>
              ) : (
                <div className="divide-y divide-surface-700/50">
                  {/* Tasks */}
                  {selectedTasks.map((ev) => (
                    <Link key={ev.id} href={`/t/${slug}/tasks?task=${ev.taskId}`}>
                      <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-750 transition-colors group">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          PRIORITY_DOT_COLORS[ev.priority ?? "MEDIUM"]
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            ev.isOverdue ? "text-red-400" : "text-surface-200 group-hover:text-surface-100"
                          )}>
                            {ev.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              "text-[10px]",
                              ev.isMyTask ? "text-primary-800 dark:text-primary-400" : "text-ui-muted"
                            )}>
                              {ev.isMyTask ? "Assigned to me" : "Team task"}
                            </span>
                            {ev.isOverdue && (
                              <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                                <AlertCircle className="w-2.5 h-2.5" /> Overdue
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:text-surface-600 dark:group-hover:text-surface-400 transition-colors" />
                      </div>
                    </Link>
                  ))}

                  {/* Recurring */}
                  {selectedRecurring.map((ev) => (
                    <Link key={ev.id} href={`/t/${slug}/recurring`}>
                      <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-750 transition-colors group">
                        <RotateCcw
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: ev.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-200 group-hover:text-surface-100 truncate">
                            {ev.title}
                          </p>
                          <span
                            className="text-[10px] font-semibold"
                            style={{ color: ev.color }}
                          >
                            Recurring task
                          </span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:text-surface-600 dark:group-hover:text-surface-400 transition-colors" />
                      </div>
                    </Link>
                  ))}

                  {/* Goals / milestones */}
                  {selectedGoals.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-750 transition-colors group">
                      {ev.kind === "MILESTONE" ? (
                        <Flag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ev.color }} />
                      ) : (
                        <Target className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ev.color }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-200 group-hover:text-surface-100 truncate">
                          {ev.title}
                        </p>
                        <span className="text-[10px] font-semibold" style={{ color: ev.color }}>
                          {ev.kind === "MILESTONE" ? "Milestone" : "Goal"}
                        </span>
                        {ev.notes && <p className="text-[10px] text-surface-500 mt-0.5 truncate">{ev.notes}</p>}
                      </div>
                      {ev.isDone && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      <button
                        onClick={() => void deleteGoalEntry(ev)}
                        disabled={deletingEntryId === ev.id}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-surface-700 disabled:opacity-40"
                        title="Delete goal/milestone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Content (channel) */}
                  {selectedContent.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-750 transition-colors group">
                      <FileText className="w-3.5 h-3.5 flex-shrink-0 text-cyan-700 dark:text-cyan-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-200 group-hover:text-surface-100 truncate">
                          {ev.title}
                        </p>
                        <span className="text-[10px] font-semibold text-cyan-800 dark:text-cyan-400/90">
                          Content{ev.contentStatus ? ` · ${ev.contentStatus.replace(/_/g, " ")}` : ""}
                        </span>
                        {ev.notes && <p className="text-[10px] text-ui-muted mt-0.5 truncate">{ev.notes}</p>}
                      </div>
                      <Link
                        href={`/t/${slug}/content`}
                        className="text-[11px] link-on-surface shrink-0"
                      >
                        Studio
                      </Link>
                      <button
                        onClick={() => void deleteGoalEntry(ev)}
                        disabled={deletingEntryId === ev.id}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-surface-700 disabled:opacity-40"
                        title="Delete content"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Week view */
        <WeekView
          weekDays={weekDays}
          eventMap={eventMap}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          slug={slug}
          userId={user.userId}
          deletingEntryId={deletingEntryId}
          onDeleteGoalEntry={deleteGoalEntry}
        />
      )}

      {/* Add calendar modal */}
      {addCalendarOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-cal-title"
          onClick={() => {
            if (!creatingCalendar) setAddCalendarOpen(false);
          }}
        >
          <div
            className="bg-surface-800 border border-surface-700 rounded-2xl p-5 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 id="add-cal-title" className="text-lg font-semibold text-surface-100">
                  New calendar
                </h2>
                <p className="text-xs text-surface-500 mt-1">
                  Pick a color once — goals and milestones on this calendar use it. Personal is yours alone; Workspace is
                  shared with the whole company (admins only, one per workspace).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!creatingCalendar) setAddCalendarOpen(false);
                }}
                className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {createCalendarError && <p className="text-xs text-red-400 mb-3">{createCalendarError}</p>}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-surface-500 block mb-1">Name</label>
                <input
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  placeholder="e.g. Product roadmap"
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-surface-500 block mb-1">Type</label>
                <select
                  value={newCalendarType}
                  onChange={(e) => setNewCalendarType(e.target.value as "PERSONAL" | "ORG")}
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="PERSONAL">Personal (only you)</option>
                  {(user.isSuperAdmin || user.level === 1) && (
                    <option value="ORG">Workspace / shared (company-wide)</option>
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs text-surface-500 block mb-1">Color</label>
                <p className="text-[11px] text-surface-500 mb-2">Shown on the grid and in the day list for this calendar&apos;s goals.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newCalendarColor}
                    onChange={(e) => setNewCalendarColor(e.target.value)}
                    className="w-12 h-12 rounded-lg border border-surface-700 bg-surface-900 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-surface-400">{newCalendarColor}</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!creatingCalendar) setAddCalendarOpen(false);
                  }}
                  disabled={creatingCalendar}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-surface-400 hover:bg-surface-700 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void createCalendar()}
                  disabled={creatingCalendar || !newCalendarName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary-600 text-white disabled:opacity-40"
                >
                  {creatingCalendar ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-[11px] text-ui-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-primary-500/30" />
          My tasks
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-surface-600" />
          Team tasks
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-red-500/30" />
          Overdue
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-violet-500/30" />
          Recurring
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded border border-emerald-500/50 bg-emerald-500/20" />
          Goals / milestones (focused calendar)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded border border-cyan-500/40 bg-cyan-500/15" />
          Content (channel)
        </div>
      </div>
    </div>
  );
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({
  weekDays,
  eventMap,
  selectedDate,
  onSelectDate,
  slug,
  userId,
  deletingEntryId,
  onDeleteGoalEntry,
}: {
  weekDays: Date[];
  eventMap: DayEvents;
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  slug: string;
  userId: string;
  deletingEntryId: string | null;
  onDeleteGoalEntry: (ev: CalendarEvent) => Promise<void>;
}) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-surface-700">
        {weekDays.map((day) => {
          const todayFlag = isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          return (
            <button
              key={dateKey(day)}
              onClick={() => onSelectDate(day)}
              className={cn(
                "py-3 text-center transition-all hover:bg-surface-750",
                isSelected && "bg-primary-500/10"
              )}
            >
              <p className="text-[10px] text-slate-600 dark:text-surface-500 uppercase tracking-wider">
                {DAY_NAMES[day.getDay()]}
              </p>
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold mx-auto mt-1",
                todayFlag ? "bg-primary-500 text-white" : isSelected ? "bg-primary-500/30 text-primary-900 dark:text-primary-300" : "text-slate-800 dark:text-surface-300"
              )}>
                {format(day, "d")}
              </div>
              {/* Event count dot */}
              {(eventMap[dateKey(day)]?.length ?? 0) > 0 && (
                <div className="flex justify-center gap-0.5 mt-1.5">
                  {(eventMap[dateKey(day)] ?? []).slice(0, 3).map((ev, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        ev.type === "recurring"
                          ? ""
                          : ev.isOverdue
                          ? "bg-red-400"
                          : ev.isMyTask
                          ? "bg-primary-400"
                          : "bg-surface-500"
                      )}
                      style={ev.type === "recurring" ? { backgroundColor: ev.color } : undefined}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day events */}
      {selectedDate && (
        <div className="divide-y divide-surface-700/50">
          <div className="px-4 py-3 border-b border-surface-700/80 bg-surface-800/50">
            <Link
              href={`/t/${slug}/tasks?new=1&due=${format(selectedDate, "yyyy-MM-dd")}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold px-3 py-2 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New task due on {format(selectedDate, "MMM d")}
            </Link>
          </div>
          {(eventMap[dateKey(selectedDate)] ?? []).length === 0 ? (
            <div className="py-12 text-center text-ui-muted text-sm">
              Nothing scheduled for {format(selectedDate, "EEEE, MMMM d")}
            </div>
          ) : (
            (eventMap[dateKey(selectedDate)] ?? []).map((ev) => (
              ev.type === "goal" ? (
                <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-750 transition-colors group">
                  {ev.kind === "MILESTONE" ? (
                    <Flag className="w-4 h-4 flex-shrink-0" style={{ color: ev.color }} />
                  ) : (
                    <Target className="w-4 h-4 flex-shrink-0" style={{ color: ev.color }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-surface-200 group-hover:text-surface-100">{ev.title}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">{ev.kind === "MILESTONE" ? "Milestone" : "Goal"}</p>
                  </div>
                  <button
                    onClick={() => void onDeleteGoalEntry(ev)}
                    disabled={deletingEntryId === ev.id}
                    className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-surface-700 disabled:opacity-40"
                    title="Delete goal/milestone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : ev.type === "content" ? (
                <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-750 transition-colors group">
                  <FileText className="w-4 h-4 flex-shrink-0 text-cyan-700 dark:text-cyan-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-surface-200 group-hover:text-surface-100">{ev.title}</p>
                    <p className="text-[10px] text-cyan-800 dark:text-cyan-400/80 mt-0.5">
                      Content{ev.contentStatus ? ` · ${ev.contentStatus.replace(/_/g, " ")}` : ""}
                    </p>
                  </div>
                  <Link href={`/t/${slug}/content`} className="text-[11px] link-on-surface shrink-0">
                    Studio
                  </Link>
                  <button
                    onClick={() => void onDeleteGoalEntry(ev)}
                    disabled={deletingEntryId === ev.id}
                    className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-surface-700 disabled:opacity-40"
                    title="Delete content"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <Link
                  key={ev.id}
                  href={
                    ev.type === "task"
                      ? `/t/${slug}/tasks?task=${ev.taskId}`
                      : `/t/${slug}/recurring`
                  }
                >
                  <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-750 transition-colors group">
                    {ev.type === "recurring" ? (
                      <RotateCcw className="w-4 h-4 flex-shrink-0" style={{ color: ev.color }} />
                    ) : (
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        PRIORITY_DOT_COLORS[ev.priority ?? "MEDIUM"]
                      )} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        ev.isOverdue ? "text-red-400" : "text-surface-200 group-hover:text-surface-100"
                      )}>
                        {ev.type === "recurring" ? "↺ " : ""}{ev.title}
                      </p>
                      <p className="text-[10px] text-surface-500 mt-0.5">
                        {ev.type === "recurring"
                          ? "Recurring task"
                          : ev.isMyTask
                          ? "Assigned to me"
                          : "Team task"}
                      </p>
                    </div>
                    {ev.isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:text-surface-600 dark:group-hover:text-surface-400 transition-colors" />
                  </div>
                </Link>
              )
            ))
          )}
        </div>
      )}
    </div>
  );
}

