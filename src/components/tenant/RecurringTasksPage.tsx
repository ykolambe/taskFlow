"use client";

import { useState, useEffect } from "react";
import {
  Plus, RotateCcw, Calendar, User, Pencil, Trash2, Power, PowerOff,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Paperclip, Upload, File, X,
} from "lucide-react";
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { PriorityBadge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { TenantTokenPayload } from "@/lib/auth";
import { RecurringTask, Priority, Frequency, User as UserType } from "@/types";
import { formatDate, DAY_NAMES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FREQ_LABELS: Record<Frequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

const FREQ_COLORS: Record<Frequency, string> = {
  DAILY: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  WEEKLY: "bg-violet-500/20 text-violet-400 border border-violet-500/30",
  MONTHLY: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
};

const WEEKDAY_PRESETS = [
  { label: "Weekdays (Mon–Fri)", days: [1, 2, 3, 4, 5] },
  { label: "Weekends (Sat–Sun)", days: [0, 6] },
  { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
];

function describeDays(daysOfWeek: number[], dayOfMonth: number | null, frequency: Frequency): string {
  if (frequency === "DAILY") return "Every day";
  if (frequency === "MONTHLY") return `On the ${dayOfMonth}${ordinal(dayOfMonth ?? 1)} of each month`;
  if (frequency === "WEEKLY") {
    if (JSON.stringify([...daysOfWeek].sort()) === JSON.stringify([1, 2, 3, 4, 5])) return "Weekdays (Mon–Fri)";
    if (JSON.stringify([...daysOfWeek].sort()) === JSON.stringify([0, 6])) return "Weekends (Sat–Sun)";
    return daysOfWeek.map((d) => DAY_NAMES[d]).join(", ");
  }
  return "";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Form state type ──────────────────────────────────────────────────────────

interface FormState {
  title: string;
  description: string;
  assigneeId: string;
  priority: Priority;
  frequency: Frequency;
  daysOfWeek: number[];
  dayOfMonth: string;
  startDate: string;
  endDate: string;
  templateAttachments: Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }>;
}

const DEFAULT_FORM: FormState = {
  title: "",
  description: "",
  assigneeId: "",
  priority: "MEDIUM",
  frequency: "DAILY",
  daysOfWeek: [1, 2, 3, 4, 5],
  dayOfMonth: "1",
  startDate: today(),
  endDate: "",
  templateAttachments: [],
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  user: TenantTokenPayload;
  initialRecurring: RecurringTask[];
  assignableUsers: UserType[];
  slug: string;
}

export default function RecurringTasksPage({ user, initialRecurring, assignableUsers, slug }: Props) {
  const [recurring, setRecurring] = useState<RecurringTask[]>(initialRecurring);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringTask | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RecurringTask | null>(null);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM, assigneeId: user.userId });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Load edit form ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description ?? "",
        assigneeId: editing.assigneeId,
        priority: editing.priority,
        frequency: editing.frequency,
        daysOfWeek: editing.daysOfWeek,
        dayOfMonth: String(editing.dayOfMonth ?? 1),
        startDate: new Date(editing.startDate).toISOString().split("T")[0],
        endDate: editing.endDate ? new Date(editing.endDate).toISOString().split("T")[0] : "",
        templateAttachments: editing.templateAttachments ?? [],
      });
      setShowForm(true);
    }
  }, [editing]);

  // ── Toggle weekday ──────────────────────────────────────────────────────────
  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d)
        ? f.daysOfWeek.filter((x) => x !== d)
        : [...f.daysOfWeek, d].sort((a, b) => a - b),
    }));
  };

  const applyPreset = (days: number[]) => setForm((f) => ({ ...f, daysOfWeek: days }));

  // ── Save (create / update) ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (form.frequency === "WEEKLY" && form.daysOfWeek.length === 0) {
      toast.error("Select at least one day"); return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        dayOfMonth: form.frequency === "MONTHLY" ? parseInt(form.dayOfMonth) : null,
        daysOfWeek: form.frequency === "WEEKLY" ? form.daysOfWeek : [],
        endDate: form.endDate || null,
        templateAttachments: form.templateAttachments,
      };

      const url = editing
        ? `/api/t/${slug}/recurring/${editing.id}`
        : `/api/t/${slug}/recurring`;
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed");

      if (editing) {
        setRecurring((prev) => prev.map((r) => (r.id === editing.id ? json.data : r)));
        toast.success("Recurring task updated");
      } else {
        setRecurring((prev) => [json.data, ...prev]);
        toast.success("Recurring task created");
      }

      closeForm();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error saving");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ───────────────────────────────────────────────────────────
  const handleToggleActive = async (rt: RecurringTask) => {
    try {
      const res = await fetch(`/api/t/${slug}/recurring/${rt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rt.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRecurring((prev) => prev.map((r) => (r.id === rt.id ? json.data : r)));
      toast.success(rt.isActive ? "Paused" : "Activated");
    } catch {
      toast.error("Failed to update");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/t/${slug}/recurring/${confirmDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setRecurring((prev) => prev.filter((r) => r.id !== confirmDelete.id));
      toast.success("Deleted");
      setConfirmDelete(null);
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  // ── Close form ──────────────────────────────────────────────────────────────
  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ ...DEFAULT_FORM, assigneeId: user.userId });
  };

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = recurring.filter((r) => {
    if (filter === "active") return r.isActive;
    if (filter === "inactive") return !r.isActive;
    return true;
  });

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary-400" />
            Recurring Tasks
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {recurring.filter((r) => r.isActive).length} active · {recurring.length} total
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ ...DEFAULT_FORM, assigneeId: user.userId }); setShowForm(true); }} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface-800 border border-surface-700 rounded-xl p-1 w-fit">
        {(["all", "active", "inactive"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
              filter === f ? "bg-primary-500 text-white" : "text-surface-400 hover:text-surface-200"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 bg-surface-800 border border-surface-700 rounded-2xl">
          <RotateCcw className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">No recurring tasks</p>
          <p className="text-surface-500 text-sm mt-1">Create one to auto-generate tasks on a schedule</p>
          <Button className="mt-4" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create Recurring Task
          </Button>
        </div>
      )}

      {/* Task cards */}
      <div className="space-y-3">
        {filtered.map((rt) => {
          const isExpanded = expandedId === rt.id;
          const canEdit = rt.creatorId === user.userId || user.isSuperAdmin;

          return (
            <div
              key={rt.id}
              className={cn(
                "bg-surface-800 border rounded-2xl overflow-hidden transition-all",
                rt.isActive ? "border-surface-700" : "border-surface-700/50 opacity-60"
              )}
            >
              {/* Card header */}
              <div
                className="flex items-center gap-3 px-4 py-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : rt.id)}
              >
                {/* Frequency badge */}
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0", FREQ_COLORS[rt.frequency])}>
                  {FREQ_LABELS[rt.frequency]}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-surface-100 truncate">{rt.title}</p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {describeDays(rt.daysOfWeek, rt.dayOfMonth, rt.frequency)}
                    {rt.nextDue && rt.isActive && (
                      <span className="text-primary-400 ml-2">· Next: {formatDate(rt.nextDue)}</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <PriorityBadge priority={rt.priority} />
                  {rt.isActive
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <AlertCircle className="w-4 h-4 text-surface-500" />}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-surface-500" /> : <ChevronDown className="w-4 h-4 text-surface-500" />}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-surface-700 px-4 py-4 space-y-4">
                  {rt.description && (
                    <p className="text-sm text-surface-400">{rt.description}</p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-surface-750 rounded-xl p-3">
                      <p className="text-[10px] text-surface-500 mb-1">Assignee</p>
                      <div className="flex items-center gap-2">
                        <Avatar firstName={rt.assignee.firstName} lastName={rt.assignee.lastName} avatarUrl={rt.assignee.avatarUrl} size="xs" />
                        <span className="text-xs text-surface-200 truncate">{rt.assignee.firstName} {rt.assignee.lastName}</span>
                      </div>
                    </div>
                    <div className="bg-surface-750 rounded-xl p-3">
                      <p className="text-[10px] text-surface-500 mb-1">Created By</p>
                      <div className="flex items-center gap-2">
                        <Avatar firstName={rt.creator.firstName} lastName={rt.creator.lastName} avatarUrl={rt.creator.avatarUrl} size="xs" />
                        <span className="text-xs text-surface-200 truncate">{rt.creator.firstName} {rt.creator.lastName}</span>
                      </div>
                    </div>
                    <div className="bg-surface-750 rounded-xl p-3">
                      <p className="text-[10px] text-surface-500 mb-1">Schedule</p>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-surface-400" />
                        <span className="text-xs text-surface-200">{describeDays(rt.daysOfWeek, rt.dayOfMonth, rt.frequency)}</span>
                      </div>
                    </div>
                    <div className="bg-surface-750 rounded-xl p-3">
                      <p className="text-[10px] text-surface-500 mb-1">Start Date</p>
                      <span className="text-xs text-surface-200">{formatDate(rt.startDate)}</span>
                    </div>
                    {rt.endDate && (
                      <div className="bg-surface-750 rounded-xl p-3">
                        <p className="text-[10px] text-surface-500 mb-1">End Date</p>
                        <span className="text-xs text-surface-200">{formatDate(rt.endDate)}</span>
                      </div>
                    )}
                    {rt.lastGenerated && (
                      <div className="bg-surface-750 rounded-xl p-3">
                        <p className="text-[10px] text-surface-500 mb-1">Last Generated</p>
                        <span className="text-xs text-surface-200">{formatDate(rt.lastGenerated)}</span>
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setEditing(rt)}
                        className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-100 bg-surface-750 hover:bg-surface-700 px-3 py-1.5 rounded-lg transition-all"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(rt)}
                        className={cn(
                          "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all",
                          rt.isActive
                            ? "text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                            : "text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                        )}
                      >
                        {rt.isActive ? <><PowerOff className="w-3 h-3" /> Pause</> : <><Power className="w-3 h-3" /> Activate</>}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(rt)}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all ml-auto"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit modal */}
      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editing ? "Edit Recurring Task" : "New Recurring Task"}
        description="Tasks will be automatically created on the scheduled days"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Title *"
            placeholder="Task title..."
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Textarea
            label="Description"
            placeholder="Optional description..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          {/* Recurring template attachments */}
          <div>
            <p className="text-sm font-medium text-surface-300 mb-2 flex items-center gap-1.5">
              <Paperclip className="w-4 h-4" /> Attachments (optional)
            </p>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs text-primary-400 hover:text-primary-300 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" /> Upload attachment
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch(
                      `/api/upload?type=attachment&slug=${encodeURIComponent(slug)}`,
                      { method: "POST", body: fd }
                    );
                    const data = await res.json();
                    if (!res.ok) {
                      toast.error(data.error || "Upload failed");
                      return;
                    }
                    setForm((f) => ({
                      ...f,
                      templateAttachments: [
                        ...f.templateAttachments,
                        {
                          fileName: data.fileName,
                          fileUrl: data.url,
                          fileSize: data.fileSize,
                          mimeType: data.mimeType,
                        },
                      ],
                    }));
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              {form.templateAttachments.length > 0 ? (
                <div className="space-y-1.5">
                  {form.templateAttachments.map((att, idx) => (
                    <div key={`${att.fileUrl}-${idx}`} className="flex items-center gap-2 bg-surface-750 border border-surface-700 rounded-lg px-3 py-2">
                      <File className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
                      <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-surface-200 hover:text-primary-400 truncate flex-1">
                        {att.fileName}
                      </a>
                      <button
                        onClick={() => setForm((f) => ({ ...f, templateAttachments: f.templateAttachments.filter((_, i) => i !== idx) }))}
                        className="text-surface-500 hover:text-red-400 transition-colors p-1"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-surface-500">No attachments. Uploaded files will be copied to every generated task instance.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Assign To"
              value={form.assigneeId}
              onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}
            >
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.roleLevel?.name})
                </option>
              ))}
            </Select>
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </div>

          {/* Frequency */}
          <div>
            <p className="text-sm font-medium text-surface-300 mb-2">Frequency</p>
            <div className="grid grid-cols-3 gap-2">
              {(["DAILY", "WEEKLY", "MONTHLY"] as Frequency[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setForm((prev) => ({ ...prev, frequency: f }))}
                  className={cn(
                    "py-2.5 rounded-xl border text-xs font-semibold transition-all",
                    form.frequency === f
                      ? "border-primary-500 bg-primary-500/20 text-primary-400"
                      : "border-surface-600 bg-surface-750 text-surface-400 hover:border-surface-500"
                  )}
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly day picker */}
          {form.frequency === "WEEKLY" && (
            <div>
              <p className="text-sm font-medium text-surface-300 mb-2">Days of the Week</p>
              {/* Presets */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {WEEKDAY_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.days)}
                    className={cn(
                      "text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all",
                      JSON.stringify([...form.daysOfWeek].sort()) === JSON.stringify([...p.days].sort())
                        ? "border-primary-500 bg-primary-500/20 text-primary-400"
                        : "border-surface-600 text-surface-400 hover:border-surface-500"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {/* Day toggles */}
              <div className="flex gap-1.5">
                {DAY_NAMES.map((name, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[11px] font-semibold border transition-all",
                      form.daysOfWeek.includes(i)
                        ? "border-primary-500 bg-primary-500/20 text-primary-300"
                        : "border-surface-600 bg-surface-750 text-surface-500 hover:border-surface-500"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly day picker */}
          {form.frequency === "MONTHLY" && (
            <div>
              <p className="text-sm font-medium text-surface-300 mb-2">Day of the Month</p>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    onClick={() => setForm((f) => ({ ...f, dayOfMonth: String(d) }))}
                    className={cn(
                      "py-2 rounded-lg text-xs font-semibold border transition-all",
                      form.dayOfMonth === String(d)
                        ? "border-primary-500 bg-primary-500/20 text-primary-300"
                        : "border-surface-600 bg-surface-750 text-surface-500 hover:border-surface-500"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={form.startDate}
              min={today()}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
            <Input
              label="End Date (optional)"
              type="date"
              value={form.endDate}
              min={form.startDate || today()}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={closeForm}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Recurring Task"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Recurring Task?"
        description={`"${confirmDelete?.title}" and its schedule will be permanently removed. Existing task instances are kept.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
