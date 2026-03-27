"use client";

import { useState, useRef, useEffect } from "react";
import {
  Lightbulb, Plus, Pin, Trash2, Pencil, Check, X, Rocket,
  Brain, CheckCircle2, XCircle, ChevronDown, ArrowRight, Zap,
  Search,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { TenantTokenPayload } from "@/lib/auth";
import { Idea, IdeaStatus, User as UserType, Priority } from "@/types";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

// ── Constants ────────────────────────────────────────────────────────────────

const IDEA_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

const STATUS_CONFIG: Record<IdeaStatus, { label: string; icon: React.ElementType; className: string }> = {
  IDEA: { label: "Idea", icon: Lightbulb, className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  THINKING: { label: "Thinking", icon: Brain, className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  CONVERTED: { label: "Converted", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  DROPPED: { label: "Dropped", icon: XCircle, className: "bg-surface-600/50 text-surface-500 border-surface-600/30" },
};

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

interface Props {
  user: TenantTokenPayload;
  slug: string;
  initialIdeas: Idea[];
  assignableUsers: UserType[];
}

// ── IdeaCard ─────────────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  onEdit,
  onDelete,
  onPin,
  onStatusChange,
  onConvert,
}: {
  idea: Idea;
  onEdit: (idea: Idea) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onStatusChange: (id: string, status: IdeaStatus) => void;
  onConvert: (idea: Idea) => void;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusCfg = STATUS_CONFIG[idea.status];
  const StatusIcon = statusCfg.icon;
  const isConverted = idea.status === "CONVERTED";
  const isDropped = idea.status === "DROPPED";

  return (
    <div
      className={cn(
        "group relative bg-surface-800 border rounded-2xl p-4 transition-all duration-200",
        "hover:border-surface-600 hover:shadow-lg hover:shadow-black/20",
        isDropped ? "opacity-50" : ""
      )}
      style={{ borderColor: idea.color + "40" }}
    >
      {/* Color accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ backgroundColor: idea.color }}
      />

      {/* Header row */}
      <div className="flex items-start gap-2 mb-2.5">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ backgroundColor: idea.color }}
        />
        <p className={cn(
          "flex-1 text-sm font-semibold leading-snug",
          isDropped ? "line-through text-surface-500" : "text-surface-100"
        )}>
          {idea.title}
        </p>
        {idea.isPinned && (
          <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />
        )}
      </div>

      {idea.body && (
        <p className="text-xs text-surface-400 leading-relaxed mb-3 line-clamp-3">
          {idea.body}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto">
        {/* Status badge */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu((v) => !v)}
            disabled={isConverted}
            className={cn(
              "flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full border transition-all",
              statusCfg.className,
              !isConverted && "hover:opacity-80 cursor-pointer",
              isConverted && "cursor-default"
            )}
          >
            <StatusIcon className="w-3 h-3" />
            {statusCfg.label}
            {!isConverted && <ChevronDown className="w-2.5 h-2.5" />}
          </button>

          {showStatusMenu && (
            <div className="absolute left-0 bottom-full mb-1 z-20 bg-surface-800 border border-surface-700 rounded-xl shadow-xl overflow-hidden min-w-32">
              {(["IDEA", "THINKING", "DROPPED"] as IdeaStatus[]).map((s) => {
                const cfg = STATUS_CONFIG[s];
                const Ic = cfg.icon;
                return (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(idea.id, s); setShowStatusMenu(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-700 transition-colors",
                      idea.status === s ? "text-primary-400" : "text-surface-300"
                    )}
                  >
                    <Ic className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-surface-600 mr-1">
            {formatDistanceToNow(new Date(idea.updatedAt), { addSuffix: true })}
          </span>

          {/* Convert button — only show when not yet converted/dropped */}
          {!isConverted && !isDropped && (
            <button
              onClick={() => onConvert(idea)}
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-all"
              title="Convert to task"
            >
              <Rocket className="w-3 h-3" /> Convert
            </button>
          )}

          {isConverted && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Task created
            </span>
          )}

          {/* Action icons */}
          <button
            onClick={() => onPin(idea.id, !idea.isPinned)}
            className={cn(
              "opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all",
              idea.isPinned
                ? "text-amber-400 opacity-100"
                : "text-surface-500 hover:text-amber-400"
            )}
            title={idea.isPinned ? "Unpin" : "Pin idea"}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {!isConverted && (
            <button
              onClick={() => onEdit(idea)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-surface-500 hover:text-primary-400 transition-all"
              title="Edit idea"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {!isConverted && (
            <button
              onClick={() => onDelete(idea.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-surface-500 hover:text-red-400 transition-all"
              title="Delete idea"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dismiss status menu on outside click */}
      {showStatusMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
      )}
    </div>
  );
}

// ── Quick Add Bar ─────────────────────────────────────────────────────────────

function QuickAdd({ onAdd }: { onAdd: (title: string, color: string) => void }) {
  const [value, setValue] = useState("");
  const [color, setColor] = useState(IDEA_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!value.trim()) return;
    onAdd(value.trim(), color);
    setValue("");
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-surface-800 border border-surface-700 rounded-2xl">
      <Zap className="w-4 h-4 text-primary-400 flex-shrink-0" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="Dump an idea… press Enter to add"
        className="flex-1 bg-transparent text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none min-w-0"
        autoFocus
      />

      {/* Color picker */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {IDEA_COLORS.slice(0, 5).map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={cn(
              "w-4 h-4 rounded-full transition-transform",
              color === c ? "scale-125 ring-2 ring-white/30" : "hover:scale-110"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <button
        onClick={submit}
        disabled={!value.trim()}
        className="flex-shrink-0 bg-primary-500 hover:bg-primary-400 disabled:opacity-30 text-white rounded-xl px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" /> Add
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function IdeaBoard({ user, slug, initialIdeas, assignableUsers }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<IdeaStatus | "ALL">("ALL");

  // Edit modal
  const [editIdea, setEditIdea] = useState<Idea | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editColor, setEditColor] = useState(IDEA_COLORS[0]);
  const [saving, setSaving] = useState(false);

  // Convert modal
  const [convertIdea, setConvertIdea] = useState<Idea | null>(null);
  const [convertAssignee, setConvertAssignee] = useState(user.userId);
  const [convertPriority, setConvertPriority] = useState<Priority>("MEDIUM");
  const [convertDueDate, setConvertDueDate] = useState("");
  const [converting, setConverting] = useState(false);

  // ── Computed ──

  const filtered = ideas.filter((idea) => {
    if (filterStatus !== "ALL" && idea.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!idea.title.toLowerCase().includes(q) && !(idea.body?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const pinnedIdeas = filtered.filter((i) => i.isPinned);
  const unpinnedIdeas = filtered.filter((i) => !i.isPinned);

  const counts = {
    ALL: ideas.length,
    IDEA: ideas.filter((i) => i.status === "IDEA").length,
    THINKING: ideas.filter((i) => i.status === "THINKING").length,
    CONVERTED: ideas.filter((i) => i.status === "CONVERTED").length,
    DROPPED: ideas.filter((i) => i.status === "DROPPED").length,
  };

  // ── Handlers ──

  const handleQuickAdd = async (title: string, color: string) => {
    const res = await fetch(`/api/t/${slug}/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, color }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || "Failed"); return; }
    setIdeas([data.data, ...ideas]);
    toast.success("Idea added!");
  };

  const handleDelete = async (id: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    const res = await fetch(`/api/t/${slug}/ideas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      const reloaded = await fetch(`/api/t/${slug}/ideas`).then((r) => r.json());
      if (reloaded.success) setIdeas(reloaded.data);
    } else {
      toast.success("Idea deleted");
    }
  };

  const handlePin = async (id: string, pinned: boolean) => {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, isPinned: pinned } : i)));
    await fetch(`/api/t/${slug}/ideas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: pinned }),
    });
  };

  const handleStatusChange = async (id: string, status: IdeaStatus) => {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    await fetch(`/api/t/${slug}/ideas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const openEdit = (idea: Idea) => {
    setEditIdea(idea);
    setEditTitle(idea.title);
    setEditBody(idea.body ?? "");
    setEditColor(idea.color);
  };

  const handleSaveEdit = async () => {
    if (!editIdea || !editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/ideas/${editIdea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody, color: editColor }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      setIdeas((prev) => prev.map((i) => (i.id === editIdea.id ? data.data : i)));
      setEditIdea(null);
      toast.success("Idea updated!");
    } finally {
      setSaving(false);
    }
  };

  const openConvert = (idea: Idea) => {
    setConvertIdea(idea);
    setConvertAssignee(user.userId);
    setConvertPriority("MEDIUM");
    setConvertDueDate("");
  };

  const handleConvert = async () => {
    if (!convertIdea) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/t/${slug}/ideas/${convertIdea.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: convertAssignee, priority: convertPriority, dueDate: convertDueDate || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      setIdeas((prev) => prev.map((i) => (i.id === convertIdea.id ? data.data.idea : i)));
      setConvertIdea(null);
      toast.success("Idea converted to task!");
    } finally {
      setConverting(false);
    }
  };

  // ── Render ──

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-surface-800 bg-surface-900 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              Idea Board
            </h1>
            <p className="text-surface-400 text-xs mt-0.5">Your personal brain dump — capture, refine, convert</p>
          </div>
        </div>

        {/* Quick add */}
        <QuickAdd onAdd={handleQuickAdd} />

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-36">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ideas…"
              className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 transition-all"
            />
          </div>
          {(["ALL", "IDEA", "THINKING", "CONVERTED", "DROPPED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
                filterStatus === s
                  ? "bg-primary-500/20 text-primary-400 border-primary-500/40"
                  : "bg-surface-800 border-surface-700 text-surface-400 hover:text-surface-200"
              )}
            >
              {s === "ALL" ? "All" : STATUS_CONFIG[s].label}
              <span className="text-[10px] opacity-70">
                {counts[s]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
              <Lightbulb className="w-8 h-8 text-amber-400/50" />
            </div>
            <p className="text-surface-400 text-sm font-medium">
              {search || filterStatus !== "ALL" ? "No ideas match your filter" : "No ideas yet"}
            </p>
            <p className="text-surface-600 text-xs mt-1">
              {search || filterStatus !== "ALL" ? "Try a different filter" : "Use the bar above to dump your first idea"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pinned section */}
            {pinnedIdeas.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Pin className="w-3 h-3" /> Pinned
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pinnedIdeas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onPin={handlePin}
                      onStatusChange={handleStatusChange}
                      onConvert={openConvert}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All other ideas */}
            {unpinnedIdeas.length > 0 && (
              <div>
                {pinnedIdeas.length > 0 && (
                  <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-widest mb-3">
                    All Ideas
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unpinnedIdeas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onPin={handlePin}
                      onStatusChange={handleStatusChange}
                      onConvert={openConvert}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      <Modal isOpen={!!editIdea} onClose={() => setEditIdea(null)} title="Edit Idea" size="md">
        {editIdea && (
          <div className="space-y-4">
            <Input
              label="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-surface-300">Notes</label>
              <Textarea
                placeholder="Expand your idea, add context, links, or rough notes…"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={5}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-surface-300">Color</label>
              <div className="flex gap-2 flex-wrap">
                {IDEA_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-full transition-transform",
                      editColor === c ? "scale-125 ring-2 ring-white/40" : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setEditIdea(null)} size="sm">Cancel</Button>
              <Button onClick={handleSaveEdit} loading={saving} disabled={!editTitle.trim()} size="sm">
                <Check className="w-3.5 h-3.5 mr-1" /> Save
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Convert Modal ── */}
      <Modal isOpen={!!convertIdea} onClose={() => setConvertIdea(null)} title="Convert to Task" size="md">
        {convertIdea && (
          <div className="space-y-4">
            <div className="bg-surface-750 rounded-xl p-4 border border-surface-700">
              <p className="text-[10px] text-surface-500 uppercase tracking-widest mb-1">Idea</p>
              <p className="text-sm font-semibold text-surface-100">{convertIdea.title}</p>
              {convertIdea.body && (
                <p className="text-xs text-surface-400 mt-1 line-clamp-2">{convertIdea.body}</p>
              )}
            </div>

            <div className="flex items-center gap-2 text-surface-400">
              <div className="flex-1 h-px bg-surface-700" />
              <ArrowRight className="w-4 h-4" />
              <div className="flex-1 h-px bg-surface-700" />
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-300">Assign To</label>
                <select
                  value={convertAssignee}
                  onChange={(e) => setConvertAssignee(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-surface-100 focus:outline-none focus:border-primary-500 transition-all"
                >
                  <option value={user.userId}>Me ({user.firstName} {user.lastName})</option>
                  {assignableUsers.filter((u) => u.id !== user.userId).map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.roleLevel.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-surface-300">Priority</label>
                  <select
                    value={convertPriority}
                    onChange={(e) => setConvertPriority(e.target.value as Priority)}
                    className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-surface-100 focus:outline-none focus:border-primary-500 transition-all"
                  >
                    {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Due Date (optional)"
                  type="date"
                  value={convertDueDate}
                  onChange={(e) => setConvertDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setConvertIdea(null)} size="sm">Cancel</Button>
              <Button onClick={handleConvert} loading={converting} size="sm">
                <Rocket className="w-3.5 h-3.5 mr-1" /> Create Task
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
