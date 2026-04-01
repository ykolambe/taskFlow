"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Calendar, RotateCcw, AlertCircle, Plus, Target, Flag, Check,
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
  type: "task" | "recurring" | "goal";
  status?: string;
  priority?: string;
  color?: string;
  taskId?: string;
  calendarId?: string;
  notes?: string;
  kind?: "GOAL" | "MILESTONE";
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

export default function CalendarView({ user, tasks, recurringTasks, calendars, calendarEntries, slug }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(calendars.map((c) => c.id));
  const [newCalendarName, setNewCalendarName] = useState("");
  const [newCalendarColor, setNewCalendarColor] = useState("#22c55e");
  const [newCalendarType, setNewCalendarType] = useState<"PERSONAL" | "ORG">("PERSONAL");
  const [creatingCalendar, setCreatingCalendar] = useState(false);
  const [goalCalendarId, setGoalCalendarId] = useState(calendars[0]?.id ?? "");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [goalKind, setGoalKind] = useState<"GOAL" | "MILESTONE">("GOAL");
  const [goalColor, setGoalColor] = useState("#22c55e");
  const [goalDate, setGoalDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [creatingGoal, setCreatingGoal] = useState(false);

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
    for (const task of tasks) {
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

    // Recurring task occurrences
    for (const rt of recurringTasks) {
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

    // Goals / milestones
    for (const goal of calendarEntries) {
      if (!selectedCalendarIds.includes(goal.calendarId)) continue;
      const d = new Date(goal.startAt);
      addEvent(d, {
        id: goal.id,
        title: goal.title,
        type: "goal",
        color: goal.color,
        calendarId: goal.calendarId,
        notes: goal.notes ?? undefined,
        kind: goal.kind,
        isDone: goal.isDone,
      });
    }

    return map;
  }, [tasks, recurringTasks, calendarEntries, selectedCalendarIds, year, month, user.userId]);

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
    try {
      await fetch(`/api/t/${slug}/calendars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCalendarName.trim(), color: newCalendarColor, type: newCalendarType }),
      });
      window.location.reload();
    } finally {
      setCreatingCalendar(false);
    }
  }

  async function createGoal() {
    if (!goalCalendarId || !goalTitle.trim() || !goalDate) return;
    setCreatingGoal(true);
    try {
      await fetch(`/api/t/${slug}/calendars/${goalCalendarId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goalTitle.trim(),
          notes: goalNotes.trim() || null,
          kind: goalKind,
          color: goalColor,
          startAt: new Date(`${goalDate}T09:00:00`).toISOString(),
        }),
      });
      window.location.reload();
    } finally {
      setCreatingGoal(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-400 flex-shrink-0" />
            Calendar
          </h1>
          <p className="text-surface-400 text-sm mt-0.5">
            Tasks and recurring schedules
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex bg-surface-800 border border-surface-700 rounded-xl p-1">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                  view === v ? "bg-primary-500 text-white" : "text-surface-400 hover:text-surface-200"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentDate((d) => subMonths(d, 1))}
          className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-xl transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-surface-100">
          {format(currentDate, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setCurrentDate((d) => addMonths(d, 1))}
          className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-xl transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-surface-400 mr-1">Calendars:</p>
          {calendars.map((c) => {
            const on = selectedCalendarIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() =>
                  setSelectedCalendarIds((prev) =>
                    on ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                  )
                }
                className={cn("px-2.5 py-1 rounded-lg text-xs border", on ? "text-white" : "text-surface-400 border-surface-600")}
                style={on ? { backgroundColor: c.color + "55", borderColor: c.color + "aa" } : undefined}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-surface-700 p-3 space-y-2">
            <p className="text-xs font-semibold text-surface-400 uppercase">New Calendar</p>
            <input value={newCalendarName} onChange={(e) => setNewCalendarName(e.target.value)} placeholder="Personal calendar name" className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm" />
            <div className="flex items-center gap-2">
              <select value={newCalendarType} onChange={(e) => setNewCalendarType(e.target.value as "PERSONAL" | "ORG")} className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs">
                <option value="PERSONAL">Personal</option>
                {(user.isSuperAdmin || user.level === 1) && <option value="ORG">Org shared</option>}
              </select>
              <input type="color" value={newCalendarColor} onChange={(e) => setNewCalendarColor(e.target.value)} className="w-9 h-9 rounded border border-surface-700 bg-surface-900" />
              <button onClick={createCalendar} disabled={creatingCalendar || !newCalendarName.trim()} className="ml-auto px-3 py-2 rounded-lg bg-primary-600 text-xs font-semibold disabled:opacity-40">
                {creatingCalendar ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-surface-700 p-3 space-y-2">
            <p className="text-xs font-semibold text-surface-400 uppercase">New Goal / Milestone</p>
            <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="Goal title" className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm" />
            <textarea value={goalNotes} onChange={(e) => setGoalNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm" />
            <div className="flex items-center gap-2 flex-wrap">
              <select value={goalCalendarId} onChange={(e) => setGoalCalendarId(e.target.value)} className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs">
                {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={goalKind} onChange={(e) => setGoalKind(e.target.value as "GOAL" | "MILESTONE")} className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs">
                <option value="GOAL">Goal</option>
                <option value="MILESTONE">Milestone</option>
              </select>
              <input type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs" />
              <input type="color" value={goalColor} onChange={(e) => setGoalColor(e.target.value)} className="w-9 h-9 rounded border border-surface-700 bg-surface-900" />
              <button onClick={createGoal} disabled={creatingGoal || !goalTitle.trim() || !goalCalendarId} className="ml-auto px-3 py-2 rounded-lg bg-emerald-600 text-xs font-semibold disabled:opacity-40">
                {creatingGoal ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {view === "month" ? (
        <div className="space-y-4">
          {/* Month grid */}
          <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden">
            {/* Day name headers */}
            <div className="grid grid-cols-7 border-b border-surface-700">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
                <div
                  key={name}
                  className="py-2.5 text-center text-[11px] font-semibold text-surface-500 uppercase tracking-wider"
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
                        ? "bg-primary-500/30 text-primary-300"
                        : "text-surface-300"
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
                              ? "bg-red-500/20 text-red-400"
                              : ev.isMyTask
                              ? "bg-primary-500/20 text-primary-400"
                              : "bg-surface-600 text-surface-300"
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
                      {events.length > 3 && (
                        <p className="text-[9px] text-surface-500 px-1">
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
                  <span className="ml-2 text-surface-500 font-normal text-xs">
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
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors px-2 py-1.5"
                  >
                    Today
                  </button>
                </div>
              </div>

              {selectedEvents.length === 0 ? (
                <div className="py-10 text-center text-surface-500 text-sm">
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
                              ev.isMyTask ? "text-primary-400" : "text-surface-500"
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
                        <ChevronRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
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
                        <ChevronRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
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
        />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-[11px] text-surface-500">
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
          <div className="w-2.5 h-2.5 rounded bg-emerald-500/30" />
          Goals / milestones
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
}: {
  weekDays: Date[];
  eventMap: DayEvents;
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  slug: string;
  userId: string;
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
              <p className="text-[10px] text-surface-500 uppercase tracking-wider">
                {DAY_NAMES[day.getDay()]}
              </p>
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold mx-auto mt-1",
                todayFlag ? "bg-primary-500 text-white" : isSelected ? "bg-primary-500/30 text-primary-300" : "text-surface-300"
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
            <div className="py-12 text-center text-surface-500 text-sm">
              Nothing scheduled for {format(selectedDate, "EEEE, MMMM d")}
            </div>
          ) : (
            (eventMap[dateKey(selectedDate)] ?? []).map((ev) => (
              <Link
                key={ev.id}
                href={
                  ev.type === "task"
                    ? `/t/${slug}/tasks?task=${ev.taskId}`
                    : ev.type === "recurring"
                    ? `/t/${slug}/recurring`
                    : `/t/${slug}/calendar`
                }
              >
                <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-750 transition-colors group">
                  {ev.type === "recurring" ? (
                    <RotateCcw className="w-4 h-4 flex-shrink-0" style={{ color: ev.color }} />
                  ) : ev.type === "goal" ? (
                    ev.kind === "MILESTONE" ? (
                      <Flag className="w-4 h-4 flex-shrink-0" style={{ color: ev.color }} />
                    ) : (
                      <Target className="w-4 h-4 flex-shrink-0" style={{ color: ev.color }} />
                    )
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
                        : ev.type === "goal"
                        ? ev.kind === "MILESTONE" ? "Milestone" : "Goal"
                        : ev.isMyTask
                        ? "Assigned to me"
                        : "Team task"}
                    </p>
                  </div>
                  {ev.isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                  <ChevronRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

