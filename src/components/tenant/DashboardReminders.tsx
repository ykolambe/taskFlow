"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Plus, Trash2, Check, Clock, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { cn, formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export interface ReminderRow {
  id: string;
  title: string;
  note: string | null;
  remindAt: string;
  isDone: boolean;
  createdAt: string;
}

interface Props {
  slug: string;
  initial: ReminderRow[];
  initialHasMore?: boolean;
}

/** Client-side ping when a reminder time passes (no server cron — good for open dashboard tab). */
export default function DashboardReminders({ slug, initial, initialHasMore = false }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ReminderRow[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [saving, setSaving] = useState(false);
  const toastedIds = useRef<Set<string>>(new Set());

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    if (open && !remindAt) {
      const t = new Date();
      t.setMinutes(t.getMinutes() + 30);
      setRemindAt(toLocalInput(t));
    }
  }, [open, remindAt]);

  useEffect(() => {
    setItems(initial);
    setHasMore(initialHasMore);
  }, [initial, initialHasMore]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const r of items) {
        if (r.isDone || toastedIds.current.has(r.id)) continue;
        const at = new Date(r.remindAt).getTime();
        if (at <= now && now - at < 5 * 60 * 1000) {
          toastedIds.current.add(r.id);
          toast(`🔔 Reminder: ${r.title}`, { duration: 8000 });
        }
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [items]);

  const mapRows = (raw: { id: string; title: string; note: string | null; remindAt: string; isDone: boolean; createdAt: string }[]): ReminderRow[] =>
    raw.map((r) => ({
      id: r.id,
      title: r.title,
      note: r.note,
      remindAt: typeof r.remindAt === "string" ? r.remindAt : new Date(r.remindAt).toISOString(),
      isDone: r.isDone,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
    }));

  const sync = async () => {
    const res = await fetch(`/api/t/${slug}/reminders?take=100`);
    const j = await res.json();
    if (res.ok && j.data) {
      setItems(mapRows(j.data));
      setHasMore(Boolean(j.meta?.hasMore));
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/t/${slug}/reminders?skip=${items.length}&take=25`);
      const j = await res.json();
      if (!res.ok || !j.data?.length) return;
      const next = mapRows(j.data);
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const r of next) {
          if (!seen.has(r.id)) {
            merged.push(r);
            seen.add(r.id);
          }
        }
        return merged;
      });
      setHasMore(Boolean(j.meta?.hasMore));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          note: note.trim() || null,
          remindAt: new Date(remindAt).toISOString(),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not save");
        return;
      }
      toast.success("Reminder set");
      setTitle("");
      setNote("");
      setOpen(false);
      await sync();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (r: ReminderRow) => {
    const res = await fetch(`/api/t/${slug}/reminders/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone: !r.isDone }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, isDone: !x.isDone } : x)));
      router.refresh();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this reminder?")) return;
    const res = await fetch(`/api/t/${slug}/reminders/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Removed");
      router.refresh();
    }
  };

  const upcoming = useMemo(() => {
    const active = items.filter((x) => !x.isDone);
    return [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items]);

  const overdue = useMemo(
    () => upcoming.filter((r) => new Date(r.remindAt) < new Date()),
    [upcoming]
  );
  const soon = useMemo(
    () => upcoming.filter((r) => new Date(r.remindAt) >= new Date()),
    [upcoming]
  );

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-violet-400" />
          <h2 className="font-semibold text-surface-100 text-sm">Reminders</h2>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)} className="gap-1">
          <Plus className="w-3.5 h-3.5" />
          {open ? "Close" : "Add"}
        </Button>
      </div>

      {open && (
        <div className="px-5 py-4 border-b border-surface-700/80 space-y-3 bg-surface-900/40">
          <Input placeholder="What should we remind you about?" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-surface-500">When</label>
            <input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              className="mt-1 w-full bg-surface-900/80 border border-surface-700/80 rounded-xl px-4 py-2.5 text-sm text-surface-100"
            />
          </div>
          <Button size="sm" loading={saving} onClick={handleAdd} disabled={!title.trim() || !remindAt}>
            Save reminder
          </Button>
        </div>
      )}

      {upcoming.length === 0 ? (
        <div className="px-5 py-10 text-center text-surface-500 text-sm">
          <Clock className="w-8 h-8 mx-auto mb-2 text-surface-600" />
          No active reminders. Add one for follow-ups, 1:1s, or deadlines.
        </div>
      ) : (
        <div className="divide-y divide-surface-700/50">
          {overdue.length > 0 && (
            <div className="px-5 py-2 bg-red-500/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Overdue</p>
            </div>
          )}
          {overdue.map((r) => (
            <ReminderLine key={r.id} r={r} onToggle={() => toggleDone(r)} onDelete={() => remove(r.id)} overdue />
          ))}
          {soon.length > 0 && overdue.length > 0 && (
            <div className="px-5 py-2 bg-surface-800/80">
              <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Upcoming</p>
            </div>
          )}
          {soon.map((r) => (
            <ReminderLine key={r.id} r={r} onToggle={() => toggleDone(r)} onDelete={() => remove(r.id)} />
          ))}
          {hasMore && upcoming.length > 0 && (
            <div className="px-5 py-3 border-t border-surface-700/50 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-xs font-medium text-violet-400 hover:text-violet-300 inline-flex items-center gap-2 disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Load more reminders
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReminderLine({
  r,
  overdue,
  onToggle,
  onDelete,
}: {
  r: ReminderRow;
  overdue?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn("flex items-start gap-3 px-5 py-3", urgencyClass(r.remindAt, overdue))}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors",
          r.isDone ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "border-surface-600 hover:border-primary-500/50"
        )}
        title={r.isDone ? "Mark open" : "Mark done"}
      >
        {r.isDone && <Check className="w-3.5 h-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", r.isDone ? "text-surface-500 line-through" : "text-surface-100")}>
          {r.title}
        </p>
        {r.note && <p className="text-xs text-surface-500 mt-0.5">{r.note}</p>}
        <p className={cn("text-[11px] mt-1 flex items-center gap-1", dueTextClass(r.remindAt, overdue))}>
          <Clock className="w-3 h-3" />
          {formatDateTime(r.remindAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="text-surface-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 flex-shrink-0"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function dueTextClass(remindAtIso: string, overdue?: boolean): string {
  if (overdue) return "text-red-400";
  const now = Date.now();
  const at = new Date(remindAtIso).getTime();
  const days = (at - now) / (24 * 60 * 60 * 1000);
  if (days <= 3) return "text-red-300";
  if (days <= 7) return "text-amber-300";
  return "text-surface-500";
}

function urgencyClass(remindAtIso: string, overdue?: boolean): string {
  if (overdue) return "bg-red-500/5";
  const now = Date.now();
  const at = new Date(remindAtIso).getTime();
  const days = (at - now) / (24 * 60 * 60 * 1000);
  if (days <= 3) return "bg-red-500/5";
  if (days <= 7) return "bg-amber-500/5";
  return "";
}
