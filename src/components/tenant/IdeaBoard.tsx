"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Lightbulb,
  Plus,
  Pin,
  Trash2,
  Pencil,
  Check,
  Rocket,
  Brain,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Search,
  Tag,
  FileText,
  PanelTopClose,
  PanelTopOpen,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { TenantTokenPayload } from "@/lib/auth";
import { Idea, IdeaStatus, IdeaTag, IdeaPage, IdeaPageSection, User as UserType, Priority } from "@/types";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

const IDEA_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6"];
const IDEA_COLOR_LABELS: Record<string, string> = {
  "#6366f1": "Indigo",
  "#8b5cf6": "Purple",
  "#ec4899": "Pink",
  "#f43f5e": "Rose",
  "#f97316": "Orange",
  "#eab308": "Yellow",
  "#22c55e": "Green",
  "#14b8a6": "Teal",
  "#06b6d4": "Cyan",
  "#3b82f6": "Blue",
};

const STATUS_CONFIG: Record<IdeaStatus, { label: string; icon: React.ElementType; className: string }> = {
  IDEA: { label: "Idea", icon: Lightbulb, className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  THINKING: { label: "Thinking", icon: Brain, className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  CONVERTED: { label: "Converted", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  DROPPED: { label: "Dropped", icon: XCircle, className: "bg-surface-600/50 text-surface-500 border-surface-600/30" },
};

const PRIORITY_LABELS: Record<Priority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

type RichIdea = Idea & { tags: IdeaTag[]; pages: IdeaPage[] };
type LinkedTask = {
  id: string;
  title: string;
  assignee?: { firstName: string; lastName: string } | null;
  priority?: string;
  status?: string;
  dueDate?: string | null;
};

interface Props {
  user: TenantTokenPayload;
  slug: string;
  initialIdeas: Idea[];
  assignableUsers: UserType[];
}

function normalizeTag(raw: unknown): IdeaTag | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const name = typeof t.name === "string" ? t.name.trim() : "";
  const color = typeof t.color === "string" ? t.color.trim() : "";
  if (!name || !color) return null;
  return { name, color };
}

function normalizePage(raw: unknown): IdeaPage | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = typeof p.id === "string" ? p.id : "";
  const title = typeof p.title === "string" ? p.title : "";
  const content = typeof p.content === "string" ? p.content : "";
  const updatedAt = typeof p.updatedAt === "string" ? p.updatedAt : new Date().toISOString();
  const sections = Array.isArray(p.sections)
    ? p.sections
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const rs = s as Record<string, unknown>;
          return {
            id: typeof rs.id === "string" ? rs.id : makeId(),
            heading: typeof rs.heading === "string" ? rs.heading : "",
            section: typeof rs.section === "string" ? rs.section : "",
            notes: typeof rs.notes === "string" ? rs.notes : "",
          };
        })
        .filter((v): v is IdeaPageSection => Boolean(v))
    : [];
  if (!id || !title) return null;
  return { id, title, content, sections, updatedAt };
}

function normalizeIdea(idea: Idea): RichIdea {
  const tags = Array.isArray((idea as { tags?: unknown }).tags) ? (idea as { tags: unknown[] }).tags.map(normalizeTag).filter((v): v is IdeaTag => Boolean(v)) : [];
  const pages = Array.isArray((idea as { pages?: unknown }).pages) ? (idea as { pages: unknown[] }).pages.map(normalizePage).filter((v): v is IdeaPage => Boolean(v)) : [];
  const convertedTaskIds = Array.isArray((idea as { convertedTaskIds?: unknown }).convertedTaskIds)
    ? (idea as { convertedTaskIds: unknown[] }).convertedTaskIds.filter((v): v is string => typeof v === "string")
    : [];
  return { ...idea, tags, pages, convertedTaskIds };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatPageTextForTask(p: IdeaPage): string {
  const sectionText = (p.sections ?? [])
    .map((s) => `### ${s.heading || "Heading"}\nSection: ${s.section || "-"}\nNotes:\n${s.notes || "-"}`)
    .join("\n\n");
  return [`## ${p.title}`, p.content, sectionText].filter(Boolean).join("\n");
}

function buildConvertDescription(idea: RichIdea, includeBody: boolean, selectedPageIds: string[]): string {
  const parts: string[] = [];
  if (includeBody && idea.body?.trim()) parts.push(idea.body.trim());
  const idSet = new Set(selectedPageIds);
  const pagesText = idea.pages
    .filter((p) => idSet.has(p.id))
    .map(formatPageTextForTask)
    .join("\n\n");
  if (pagesText) parts.push(pagesText);
  return parts.join("\n\n");
}

function TagChip({ tag }: { tag: IdeaTag }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px]" style={{ borderColor: `${tag.color}80`, color: tag.color, backgroundColor: `${tag.color}20` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </span>
  );
}

function IdeaCard({ idea, onEdit, onDelete, onPin, onStatusChange, onConvert }: { idea: RichIdea; onEdit: (idea: RichIdea) => void; onDelete: (id: string) => void; onPin: (id: string, pinned: boolean) => void; onStatusChange: (id: string, status: IdeaStatus) => void; onConvert: (idea: RichIdea) => void; }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusCfg = STATUS_CONFIG[idea.status];
  const StatusIcon = statusCfg.icon;
  const isConverted = idea.status === "CONVERTED";
  const convertedCount = (idea.convertedTaskIds?.length ?? 0) + (idea.convertedTaskId ? 1 : 0);
  const isDropped = idea.status === "DROPPED";

  return (
    <div onClick={() => onEdit(idea)} className={cn("group relative bg-surface-800 border rounded-2xl p-4 transition-all duration-200 cursor-pointer", "hover:border-surface-600 hover:shadow-lg hover:shadow-black/20", isDropped ? "opacity-50" : "")} style={{ borderColor: idea.color + "40" }}>
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ backgroundColor: idea.color }} />
      <div className="flex items-start gap-2 mb-2.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: idea.color }} />
        <p className={cn("flex-1 text-sm font-semibold leading-snug", isDropped ? "line-through text-surface-500" : "text-surface-100")}>{idea.title}</p>
        {idea.isPinned && <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />}
      </div>

      {idea.body && <p className="text-xs text-surface-400 leading-relaxed mb-2 line-clamp-3">{idea.body}</p>}

      {(idea.tags.length > 0 || idea.pages.length > 0) && (
        <div className="mb-3 space-y-1.5">
          {idea.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {idea.tags.slice(0, 4).map((t) => <TagChip key={`${idea.id}-${t.name}-${t.color}`} tag={t} />)}
              {idea.tags.length > 4 && <span className="text-[10px] text-surface-500">+{idea.tags.length - 4}</span>}
            </div>
          )}
          {idea.pages.length > 0 && (
            <div className="inline-flex items-center gap-1 text-[10px] text-surface-500">
              <FileText className="w-3 h-3" /> {idea.pages.length} page{idea.pages.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto">
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); setShowStatusMenu((v) => !v); }} disabled={isConverted} className={cn("flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full border transition-all", statusCfg.className, !isConverted && "hover:opacity-80 cursor-pointer", isConverted && "cursor-default")}>
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
                  <button key={s} onClick={(e) => { e.stopPropagation(); onStatusChange(idea.id, s); setShowStatusMenu(false); }} className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-700 transition-colors", idea.status === s ? "text-primary-400" : "text-surface-300")}>
                    <Ic className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-surface-600 mr-1">{formatDistanceToNow(new Date(idea.updatedAt), { addSuffix: true })}</span>
          {!isDropped && (
            <button onClick={(e) => { e.stopPropagation(); onConvert(idea); }} className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-all" title="Convert to task">
              <Rocket className="w-3 h-3" /> {isConverted ? "Convert again" : "Convert"}
            </button>
          )}
          {isConverted && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium"><CheckCircle2 className="w-3 h-3" /> {convertedCount > 1 ? `${convertedCount} tasks created` : "Task created"}</span>}
          <button onClick={(e) => { e.stopPropagation(); onPin(idea.id, !idea.isPinned); }} className={cn("opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all", idea.isPinned ? "text-amber-400 opacity-100" : "text-surface-500 hover:text-amber-400")} title={idea.isPinned ? "Unpin" : "Pin idea"}><Pin className="w-3.5 h-3.5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(idea); }} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-surface-500 hover:text-primary-400 transition-all" title="Edit idea"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(idea.id); }} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-surface-500 hover:text-red-400 transition-all" title="Delete idea"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {showStatusMenu && <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowStatusMenu(false); }} />}
    </div>
  );
}

function QuickAdd({ onAdd, knownTags }: { onAdd: (payload: { title: string; body: string; color: string; tags: IdeaTag[] }) => void; knownTags: IdeaTag[]; }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState(IDEA_COLORS[0]);
  const [tags, setTags] = useState<IdeaTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#22c55e");

  const deriveTitleFromBody = (text: string): string => {
    const firstLine = text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
    return firstLine.slice(0, 120);
  };

  const canSubmit = Boolean(title.trim() || body.trim());

  const submit = () => {
    if (!canSubmit) return;
    const resolvedTitle = title.trim() || deriveTitleFromBody(body);
    onAdd({ title: resolvedTitle, body: body.trim(), color, tags });
    setTitle("");
    setBody("");
    setTags([]);
  };

  const addTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    if (tags.some((t) => t.name.toLowerCase() == name.toLowerCase())) return;
    setTags((prev) => [...prev, { name, color: newTagColor }]);
    setNewTagName("");
  };

  return (
    <div className="p-4 bg-surface-800 border border-surface-700 rounded-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-primary-400 flex-shrink-0" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Dump idea headline... (optional if details below)" className="flex-1 bg-transparent text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none min-w-0" />
      </div>
      <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional details, context, links..." />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-surface-500">Color:</span>
        {IDEA_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} className={cn("w-4 h-4 rounded-full transition-transform", color === c ? "scale-125 ring-2 ring-white/30" : "hover:scale-110")} style={{ backgroundColor: c }} />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag (e.g. Marketing)" />
          <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-10 h-10 rounded border border-surface-600 bg-surface-800" />
          <Button size="sm" variant="secondary" onClick={addTag}><Plus className="w-3 h-3" /></Button>
        </div>
        {knownTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-surface-500 mr-1">Quick tags:</span>
            {knownTags.slice(0, 8).map((t) => (
              <button key={`${t.name}-${t.color}`} onClick={() => !tags.some((x) => x.name.toLowerCase() === t.name.toLowerCase()) && setTags((prev) => [...prev, t])}>
                <TagChip tag={t} />
              </button>
            ))}
          </div>
        )}
        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {tags.map((t) => (
              <button key={`${t.name}-${t.color}`} onClick={() => setTags((prev) => prev.filter((x) => x.name !== t.name))}><TagChip tag={t} /></button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={submit} disabled={!canSubmit} className="flex-shrink-0 bg-primary-500 hover:bg-primary-400 disabled:opacity-30 text-white rounded-xl px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Idea</button>
      </div>
    </div>
  );
}

export default function IdeaBoard({ user, slug, initialIdeas, assignableUsers }: Props) {
  const [ideas, setIdeas] = useState<RichIdea[]>(initialIdeas.map(normalizeIdea));
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<IdeaStatus | "ALL">("ALL");
  const [filterTag, setFilterTag] = useState("ALL");
  const [filterColor, setFilterColor] = useState("ALL");

  const [editIdea, setEditIdea] = useState<RichIdea | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editColor, setEditColor] = useState(IDEA_COLORS[0]);
  const [editTags, setEditTags] = useState<IdeaTag[]>([]);
  const [editPages, setEditPages] = useState<IdeaPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#22c55e");
  const [saving, setSaving] = useState(false);

  const [convertIdea, setConvertIdea] = useState<RichIdea | null>(null);
  const [convertAssignee, setConvertAssignee] = useState(user.userId);
  const [convertPriority, setConvertPriority] = useState<Priority>("MEDIUM");
  const [convertDueDate, setConvertDueDate] = useState("");
  const [convertTitle, setConvertTitle] = useState("");
  const [convertDescription, setConvertDescription] = useState("");
  /** Include idea quick summary (body) in the generated task description */
  const [convertIncludeBody, setConvertIncludeBody] = useState(true);
  /** Page ids to append as formatted sections in the task description */
  const [convertSelectedPageIds, setConvertSelectedPageIds] = useState<string[]>([]);
  const [converting, setConverting] = useState(false);
  const [creatorCollapsed, setCreatorCollapsed] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [loadingLinkedTasks, setLoadingLinkedTasks] = useState(false);

  useEffect(() => {
    if (!convertIdea) return;
    setConvertDescription(buildConvertDescription(convertIdea, convertIncludeBody, convertSelectedPageIds));
  }, [convertIdea, convertIncludeBody, convertSelectedPageIds]);

  const knownTags = useMemo(() => {
    const map = new Map<string, IdeaTag>();
    ideas.forEach((idea) => idea.tags.forEach((t) => {
      const key = t.name.toLowerCase();
      if (!map.has(key)) map.set(key, t);
    }));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [ideas]);

  const filtered = ideas.filter((idea) => {
    if (filterStatus !== "ALL" && idea.status !== filterStatus) return false;
    if (filterColor !== "ALL" && idea.color.toLowerCase() !== filterColor.toLowerCase()) return false;
    if (filterTag !== "ALL" && !idea.tags.some((t) => t.name.toLowerCase() === filterTag.toLowerCase())) return false;
    if (search) {
      const q = search.toLowerCase();
      const pageHit = idea.pages.some((p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
      const tagHit = idea.tags.some((t) => t.name.toLowerCase().includes(q));
      if (!idea.title.toLowerCase().includes(q) && !(idea.body?.toLowerCase().includes(q)) && !tagHit && !pageHit) return false;
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

  const handleQuickAdd = async (payload: { title: string; body: string; color: string; tags: IdeaTag[] }) => {
    const res = await fetch(`/api/t/${slug}/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: payload.title, body: payload.body || null, color: payload.color, tags: payload.tags, pages: [] }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || "Failed"); return; }
    setIdeas((prev) => [normalizeIdea(data.data), ...prev]);
    toast.success("Idea added!");
  };

  const handleDelete = async (id: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    const res = await fetch(`/api/t/${slug}/ideas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      const reloaded = await fetch(`/api/t/${slug}/ideas`).then((r) => r.json());
      if (reloaded.success) setIdeas(reloaded.data.map(normalizeIdea));
    } else {
      toast.success("Idea deleted");
    }
  };

  const handlePin = async (id: string, pinned: boolean) => {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, isPinned: pinned } : i)));
    await fetch(`/api/t/${slug}/ideas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPinned: pinned }) });
  };

  const handleStatusChange = async (id: string, status: IdeaStatus) => {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    await fetch(`/api/t/${slug}/ideas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  };

  const openEdit = (idea: RichIdea) => {
    setEditIdea(idea);
    setEditTitle(idea.title);
    setEditBody(idea.body ?? "");
    setEditColor(idea.color);
    setEditTags(idea.tags);
    setEditPages(idea.pages.length ? idea.pages : [{ id: makeId(), title: "Page 1", content: "", sections: [], updatedAt: new Date().toISOString() }]);
    setActivePageId((idea.pages[0]?.id ?? null) || null);
    setLinkedTasks([]);
    setLoadingLinkedTasks(true);
    void fetch(`/api/t/${slug}/ideas/${idea.id}/tasks`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) setLinkedTasks(j.data as LinkedTask[]);
      })
      .catch(() => {})
      .finally(() => setLoadingLinkedTasks(false));
  };

  const addEditTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    if (editTags.some((t) => t.name.toLowerCase() === name.toLowerCase())) return;
    setEditTags((prev) => [...prev, { name, color: newTagColor }]);
    setNewTagName("");
  };

  const addPage = () => {
    const next = { id: makeId(), title: `Page ${editPages.length + 1}`, content: "", sections: [], updatedAt: new Date().toISOString() };
    setEditPages((prev) => [...prev, next]);
    setActivePageId(next.id);
  };

  const updatePage = (id: string, patch: Partial<IdeaPage>) => {
    setEditPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)));
  };

  const addPageSection = (pageId: string) => {
    const nextSection: IdeaPageSection = {
      id: makeId(),
      heading: "",
      section: "",
      notes: "",
    };
    setEditPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, sections: [...(p.sections ?? []), nextSection], updatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const updatePageSection = (pageId: string, sectionId: string, patch: Partial<IdeaPageSection>) => {
    setEditPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              sections: (p.sections ?? []).map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  const removePageSection = (pageId: string, sectionId: string) => {
    setEditPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, sections: (p.sections ?? []).filter((s) => s.id !== sectionId), updatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const deletePage = (id: string) => {
    const next = editPages.filter((p) => p.id !== id);
    setEditPages(next);
    if (activePageId === id) setActivePageId(next[0]?.id ?? null);
  };

  const handleSaveEdit = async () => {
    if (!editIdea || !editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/ideas/${editIdea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, body: editBody, color: editColor, tags: editTags, pages: editPages }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      const normalized = normalizeIdea(data.data);
      setIdeas((prev) => prev.map((i) => (i.id === editIdea.id ? normalized : i)));
      setEditIdea(null);
      toast.success("Idea updated!");
    } finally {
      setSaving(false);
    }
  };

  const openConvert = (idea: RichIdea) => {
    setConvertIdea(idea);
    setConvertAssignee(user.userId);
    setConvertPriority("MEDIUM");
    setConvertDueDate("");
    setConvertTitle(idea.title);
    setConvertIncludeBody(true);
    setConvertSelectedPageIds(idea.pages.map((p) => p.id));
  };

  const handleConvert = async () => {
    if (!convertIdea || !convertTitle.trim()) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/t/${slug}/ideas/${convertIdea.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: convertTitle,
          description: convertDescription,
          assigneeId: convertAssignee,
          priority: convertPriority,
          dueDate: convertDueDate || null,
          tags: convertIdea.tags.map((t) => t.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      setIdeas((prev) => prev.map((i) => (i.id === convertIdea.id ? normalizeIdea(data.data.idea) : i)));
      setConvertIdea(null);
      toast.success("Idea converted to task!");
    } finally {
      setConverting(false);
    }
  };

  const activePage = editPages.find((p) => p.id === activePageId) ?? null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 sm:px-6 py-4 border-b border-surface-800 bg-surface-900 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-400" /> Idea Board</h1>
            <p className="text-surface-400 text-xs mt-0.5">Capture headlines, tag them, expand into pages, then convert cleanly into tasks.</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCreatorCollapsed((v) => !v)}
            title={creatorCollapsed ? "Expand creation panel" : "Collapse creation panel"}
          >
            {creatorCollapsed ? <PanelTopOpen className="w-4 h-4 mr-1" /> : <PanelTopClose className="w-4 h-4 mr-1" />}
            {creatorCollapsed ? "Expand" : "Collapse"}
          </Button>
        </div>

        {!creatorCollapsed && <QuickAdd onAdd={handleQuickAdd} knownTags={knownTags} />}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-36">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ideas, tags, pages..." className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 transition-all" />
          </div>
          <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-300">
            <option value="ALL">All tags</option>
            {knownTags.map((t) => <option key={`${t.name}-${t.color}`} value={t.name}>{t.name}</option>)}
          </select>
          <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-300">
            <option value="ALL">All colors</option>
            {IDEA_COLORS.map((c) => <option key={c} value={c}>{IDEA_COLOR_LABELS[c] ?? c}</option>)}
          </select>
          {(["ALL", "IDEA", "THINKING", "CONVERTED", "DROPPED"] as const).map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border", filterStatus === s ? "bg-primary-500/20 text-primary-400 border-primary-500/40" : "bg-surface-800 border-surface-700 text-surface-400 hover:text-surface-200")}>
              {s === "ALL" ? "All" : STATUS_CONFIG[s].label}
              <span className="text-[10px] opacity-70">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4"><Lightbulb className="w-8 h-8 text-amber-400/50" /></div>
            <p className="text-surface-400 text-sm font-medium">{search || filterStatus !== "ALL" || filterTag !== "ALL" || filterColor !== "ALL" ? "No ideas match your filter" : "No ideas yet"}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pinnedIdeas.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Pin className="w-3 h-3" /> Pinned</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pinnedIdeas.map((idea) => <IdeaCard key={idea.id} idea={idea} onEdit={openEdit} onDelete={handleDelete} onPin={handlePin} onStatusChange={handleStatusChange} onConvert={openConvert} />)}
                </div>
              </div>
            )}
            {unpinnedIdeas.length > 0 && (
              <div>
                {pinnedIdeas.length > 0 && <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-widest mb-3">All Ideas</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unpinnedIdeas.map((idea) => <IdeaCard key={idea.id} idea={idea} onEdit={openEdit} onDelete={handleDelete} onPin={handlePin} onStatusChange={handleStatusChange} onConvert={openConvert} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={!!editIdea} onClose={() => setEditIdea(null)} title="Edit Idea" size="lg">
        {editIdea && (
          <div className="space-y-4">
            <Input label="Headline" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-surface-300">Quick Summary</label>
              <Textarea placeholder="Top-level summary..." value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-surface-300">Card color:</span>
              {IDEA_COLORS.map((c) => <button key={c} onClick={() => setEditColor(c)} className={cn("w-6 h-6 rounded-full", editColor === c ? "ring-2 ring-white/40" : "")} style={{ backgroundColor: c }} />)}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-surface-300">Tags</p>
              <div className="flex items-center gap-2">
                <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" />
                <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-10 h-10 rounded border border-surface-600 bg-surface-800" />
                <Button size="sm" onClick={addEditTag} variant="secondary"><Plus className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {editTags.map((t) => (
                  <button key={`${t.name}-${t.color}`} onClick={() => setEditTags((prev) => prev.filter((x) => x.name !== t.name))}><TagChip tag={t} /></button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-surface-300">Detailed Pages</p>
                <Button size="sm" variant="secondary" onClick={addPage}><Plus className="w-3.5 h-3.5 mr-1" /> Add Page</Button>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4 border border-surface-700 rounded-xl p-2 space-y-1 max-h-56 overflow-y-auto">
                  {editPages.map((p) => (
                    <div key={p.id} className={cn("flex items-center gap-1 rounded px-2 py-1", activePageId === p.id ? "bg-surface-700" : "hover:bg-surface-800") }>
                      <button className="flex-1 text-left text-xs text-surface-200 truncate" onClick={() => setActivePageId(p.id)}>{p.title}</button>
                      <button onClick={() => deletePage(p.id)} className="text-surface-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <div className="col-span-8 space-y-2">
                  {activePage ? (
                    <>
                      <Input value={activePage.title} onChange={(e) => updatePage(activePage.id, { title: e.target.value })} placeholder="Page title" />
                      <Textarea rows={8} value={activePage.content} onChange={(e) => updatePage(activePage.id, { content: e.target.value })} placeholder="Detailed report/content for this page..." />
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Sections</p>
                          <Button size="sm" variant="secondary" onClick={() => addPageSection(activePage.id)}>
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Section
                          </Button>
                        </div>
                        {(activePage.sections ?? []).length === 0 ? (
                          <div className="text-xs text-surface-500 p-3 border border-dashed border-surface-700 rounded-xl">
                            Add sections with heading, section label and notes for clear structure.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(activePage.sections ?? []).map((sec, idx) => (
                              <div key={sec.id} className="rounded-xl border border-surface-700 bg-surface-850/60 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-surface-400 font-medium">Section {idx + 1}</p>
                                  <button
                                    onClick={() => removePageSection(activePage.id, sec.id)}
                                    className="text-surface-500 hover:text-red-400"
                                    title="Remove section"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <Input
                                  value={sec.heading}
                                  onChange={(e) => updatePageSection(activePage.id, sec.id, { heading: e.target.value })}
                                  placeholder="Heading (e.g. Background)"
                                />
                                <Input
                                  value={sec.section}
                                  onChange={(e) => updatePageSection(activePage.id, sec.id, { section: e.target.value })}
                                  placeholder="Section label (e.g. Market Context)"
                                />
                                <Textarea
                                  rows={4}
                                  value={sec.notes}
                                  onChange={(e) => updatePageSection(activePage.id, sec.id, { notes: e.target.value })}
                                  placeholder="Notes / observations / details..."
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-surface-500 p-4 border border-dashed border-surface-700 rounded-xl">Create a page to write detailed report notes.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-surface-300">Linked Tasks Created From This Idea</p>
              {loadingLinkedTasks ? (
                <div className="text-xs text-surface-500 p-3 border border-dashed border-surface-700 rounded-xl">Loading linked tasks...</div>
              ) : linkedTasks.length === 0 ? (
                <div className="text-xs text-surface-500 p-3 border border-dashed border-surface-700 rounded-xl">No tasks created from this idea yet.</div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {linkedTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/t/${slug}/tasks?task=${t.id}`}
                      className="flex items-center justify-between rounded-xl border border-surface-700 px-3 py-2 hover:bg-surface-800 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-surface-100 truncate">{t.title}</p>
                        <p className="text-[11px] text-surface-500">
                          {t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Unassigned"} · {t.status ?? "TODO"}
                        </p>
                      </div>
                      <span className="text-[10px] text-primary-400 font-semibold">View</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setEditIdea(null)} size="sm">Cancel</Button>
              <Button onClick={handleSaveEdit} loading={saving} disabled={!editTitle.trim()} size="sm"><Check className="w-3.5 h-3.5 mr-1" /> Save</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!convertIdea} onClose={() => setConvertIdea(null)} title="Convert Idea to Task" size="lg">
        {convertIdea && (
          <div className="space-y-4">
            <Input label="Task title" value={convertTitle} onChange={(e) => setConvertTitle(e.target.value)} />

            {(convertIdea.body?.trim() || convertIdea.pages.length > 0) && (
              <div className="rounded-xl border border-surface-700 bg-surface-850/50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-surface-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary-400" />
                    Include in task description
                  </p>
                  {convertIdea.pages.length > 1 && (
                    <div className="flex gap-2 text-[10px]">
                      <button
                        type="button"
                        className="text-primary-400 hover:text-primary-300"
                        onClick={() => setConvertSelectedPageIds(convertIdea.pages.map((p) => p.id))}
                      >
                        All pages
                      </button>
                      <span className="text-surface-600">·</span>
                      <button type="button" className="text-surface-400 hover:text-surface-300" onClick={() => setConvertSelectedPageIds([])}>
                        No pages
                      </button>
                    </div>
                  )}
                </div>
                {convertIdea.body?.trim() && (
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-surface-200">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-surface-600"
                      checked={convertIncludeBody}
                      onChange={(e) => setConvertIncludeBody(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-surface-100">Quick summary</span>
                      <span className="text-surface-500 block mt-0.5">Main idea notes (first text field on the card)</span>
                    </span>
                  </label>
                )}
                {convertIdea.pages.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-surface-700/80">
                    <p className="text-[10px] uppercase tracking-wider text-surface-500">Detailed pages</p>
                    {convertIdea.pages.map((p) => (
                      <label key={p.id} className="flex items-start gap-2 cursor-pointer text-xs text-surface-200">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-surface-600"
                          checked={convertSelectedPageIds.includes(p.id)}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setConvertSelectedPageIds((prev) =>
                              on ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                            );
                          }}
                        />
                        <span className="min-w-0">
                          <span className="font-medium text-surface-100 truncate block">{p.title || "Untitled page"}</span>
                          {(p.content?.trim() || (p.sections?.length ?? 0) > 0) && (
                            <span className="text-surface-500 text-[10px]">Content + sections</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-surface-500 pt-1">
                  Updating these options refreshes the description below; you can still edit the text before creating the task.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-surface-300">Task description</label>
              <Textarea rows={7} value={convertDescription} onChange={(e) => setConvertDescription(e.target.value)} />
            </div>
            {convertIdea.tags.length > 0 && (
              <div>
                <p className="text-xs text-surface-400 mb-1 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Tags will be included in task description:</p>
                <div className="flex gap-1 flex-wrap">{convertIdea.tags.map((t) => <TagChip key={`${t.name}-${t.color}`} tag={t} />)}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-300">Assign To</label>
                <select value={convertAssignee} onChange={(e) => setConvertAssignee(e.target.value)} className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-surface-100">
                  <option value={user.userId}>Me ({user.firstName} {user.lastName})</option>
                  {assignableUsers.filter((u) => u.id !== user.userId).map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} - {u.roleLevel.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-300">Priority</label>
                <select value={convertPriority} onChange={(e) => setConvertPriority(e.target.value as Priority)} className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-surface-100">
                  {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                </select>
              </div>
            </div>
            <Input label="Due Date (optional)" type="date" value={convertDueDate} onChange={(e) => setConvertDueDate(e.target.value)} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setConvertIdea(null)} size="sm">Cancel</Button>
              <Button onClick={handleConvert} loading={converting} size="sm" disabled={!convertTitle.trim()}><Rocket className="w-3.5 h-3.5 mr-1" /> Create Task</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
