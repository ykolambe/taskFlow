"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText, Plus, Users, LayoutGrid, List, CalendarDays, ExternalLink, Trash2, X, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { format, isSameDay, parseISO } from "date-fns";
import { TenantTokenPayload } from "@/lib/auth";
import type { ContentEntryStatus } from "@/types";
import { cn } from "@/lib/utils";

type UserBrief = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  roleLevelId: string;
  roleLevel: { id: string; name: string; level: number; color: string; canApprove: boolean };
  isSuperAdmin: boolean;
};

type CalendarMemberRow = {
  id: string;
  userId: string;
  role: "VIEW" | "EDIT" | "PUBLISH" | "ADMIN";
  user: UserBrief;
};

type ContentEntryRow = {
  id: string;
  calendarId: string;
  title: string;
  notes: string | null;
  kind: "CONTENT";
  color: string;
  startAt: string;
  endAt: string | null;
  isDone: boolean;
  contentStatus: string | null;
  url: string | null;
  assigneeId: string | null;
  assignee: UserBrief | null;
};

export type ChannelCalSerialized = {
  id: string;
  name: string;
  color: string;
  contentChannel: string | null;
  members: CalendarMemberRow[];
  entries: ContentEntryRow[];
};

type EntryWithCal = ContentEntryRow & { _calendarName: string; _channelTag: string | null };

const STATUSES: ContentEntryStatus[] = [
  "IDEA",
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "CANCELLED",
];

const STATUS_LABEL: Record<ContentEntryStatus, string> = {
  IDEA: "Idea",
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  READY_TO_PUBLISH: "Ready to publish",
  PUBLISHED: "Published",
  CANCELLED: "Cancelled",
};

function nameOf(u: Pick<UserBrief, "firstName" | "lastName">) {
  return `${u.firstName} ${u.lastName}`.trim();
}

function stripCalMeta(e: EntryWithCal): ContentEntryRow {
  const { _calendarName: _a, _channelTag: _b, ...row } = e;
  return row;
}

interface Props {
  slug: string;
  user: TenantTokenPayload;
  companyUsers: UserBrief[];
  initialCalendars: ChannelCalSerialized[];
  aiEnabled?: boolean;
}

export default function ContentStudioView({ slug, user, companyUsers, initialCalendars, aiEnabled = false }: Props) {
  const router = useRouter();
  const calendars = initialCalendars;
  const [selectedId, setSelectedId] = useState(() => initialCalendars[0]?.id ?? "");

  useEffect(() => {
    if (calendars.length && !calendars.some((c) => c.id === selectedId)) {
      setSelectedId(calendars[0].id);
    }
  }, [calendars, selectedId]);
  const [tab, setTab] = useState<"today" | "table" | "board">("table");

  const [channelOpen, setChannelOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelLabel, setChannelLabel] = useState("");
  const [channelColor, setChannelColor] = useState("#6366f1");
  const [channelSaving, setChannelSaving] = useState(false);

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryTitle, setEntryTitle] = useState("");
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [entryStatus, setEntryStatus] = useState<ContentEntryStatus>("DRAFT");
  const [entryAssignee, setEntryAssignee] = useState("");
  const [entryUrl, setEntryUrl] = useState("");
  const [entryNotes, setEntryNotes] = useState("");
  const [entrySaving, setEntrySaving] = useState(false);

  const [membersOpen, setMembersOpen] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"VIEW" | "EDIT" | "PUBLISH" | "ADMIN">("EDIT");
  const [memberSaving, setMemberSaving] = useState(false);

  const [editingEntry, setEditingEntry] = useState<ContentEntryRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const canCreateChannel = user.isSuperAdmin || user.level <= 1;
  const canManageChannels = canCreateChannel;
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);

  const [generateIdeasOpen, setGenerateIdeasOpen] = useState(false);
  const [generateIdeasStartDate, setGenerateIdeasStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [generateIdeasDays, setGenerateIdeasDays] = useState(14);
  const [generateIdeasSaving, setGenerateIdeasSaving] = useState(false);

  const [generateContentSaving, setGenerateContentSaving] = useState(false);
  const selected = calendars.find((c) => c.id === selectedId) ?? calendars[0];
  const allEntries = useMemo<EntryWithCal[]>(
    () =>
      calendars.flatMap((c) =>
        c.entries.map((e) => ({ ...e, _calendarName: c.name, _channelTag: c.contentChannel }))
      ),
    [calendars]
  );

  const todayEntries = useMemo(() => {
    const t = new Date();
    return allEntries.filter((e) => {
      try {
        return isSameDay(parseISO(e.startAt), t);
      } catch {
        return false;
      }
    });
  }, [allEntries]);

  const tableEntries = useMemo(() => {
    const list = selected ? selected.entries.map((e) => ({ ...e, _calendarName: selected.name, _channelTag: selected.contentChannel })) : [];
    return [...list].sort((a, b) => (a.startAt < b.startAt ? 1 : -1));
  }, [selected]);

  const refresh = () => router.refresh();

  async function createChannel() {
    if (!channelName.trim()) {
      toast.error("Name is required");
      return;
    }
    setChannelSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/calendars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: channelName.trim(),
          type: "CHANNEL",
          color: channelColor,
          contentChannel: channelLabel.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not create channel");
        return;
      }
      toast.success("Channel created");
      setChannelOpen(false);
      setChannelName("");
      setChannelLabel("");
      setChannelColor("#6366f1");
      refresh();
    } finally {
      setChannelSaving(false);
    }
  }

  async function deleteChannel(calendarId: string) {
    if (!canManageChannels) return;
    const cal = calendars.find((c) => c.id === calendarId);
    const ok = window.confirm(
      `Archive "${cal?.name ?? "this board"}"?\n\nThis removes the board from the main Calendar view and hides its content items.`
    );
    if (!ok) return;
    setDeletingChannelId(calendarId);
    try {
      const res = await fetch(`/api/t/${slug}/calendars/${calendarId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not archive channel");
        return;
      }
      toast.success("Channel archived");
      if (selectedId === calendarId) {
        const remaining = calendars.filter((c) => c.id !== calendarId);
        setSelectedId(remaining[0]?.id ?? "");
      }
      refresh();
    } finally {
      setDeletingChannelId(null);
    }
  }

  async function createEntry() {
    if (!selected || !entryTitle.trim()) {
      toast.error("Pick a channel and enter a title");
      return;
    }
    setEntrySaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/calendars/${selected.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: entryTitle.trim(),
          kind: "CONTENT",
          notes: entryNotes.trim() || null,
          startAt: new Date(`${entryDate}T12:00:00`).toISOString(),
          contentStatus: entryStatus,
          assigneeId: entryAssignee || null,
          url: entryUrl.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not create");
        return;
      }
      toast.success("Content item created");
      setEntryOpen(false);
      setEntryTitle("");
      setEntryNotes("");
      setEntryUrl("");
      setEntryAssignee("");
      setEntryStatus("DRAFT");
      refresh();
    } finally {
      setEntrySaving(false);
    }
  }

  async function patchEntry(entry: ContentEntryRow, patch: Record<string, unknown>) {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/calendars/${entry.calendarId}/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not save");
        return;
      }
      toast.success("Saved");
      setEditingEntry(null);
      refresh();
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteEntry(entry: ContentEntryRow) {
    if (!window.confirm(`Delete “${entry.title}”?`)) return;
    const res = await fetch(`/api/t/${slug}/calendars/${entry.calendarId}/entries/${entry.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof json?.error === "string" ? json.error : "Could not delete");
      return;
    }
    toast.success("Deleted");
    setEditingEntry(null);
    refresh();
  }

  async function addMember() {
    if (!selected || !memberUserId) return;
    setMemberSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/calendars/${selected.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberUserId, role: memberRole }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not add member");
        return;
      }
      toast.success("Member updated");
      setMemberUserId("");
      refresh();
    } finally {
      setMemberSaving(false);
    }
  }

  async function removeMember(userId: string) {
    if (!selected) return;
    const res = await fetch(`/api/t/${slug}/calendars/${selected.id}/members?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof json?.error === "string" ? json.error : "Could not remove");
      return;
    }
    toast.success("Removed");
    refresh();
  }

  async function generateIdeasForBoard() {
    if (!selected) return;
    setGenerateIdeasSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/calendars/${selected.id}/ai/generate-ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: generateIdeasStartDate,
          days: generateIdeasDays,
          replaceExistingIdeas: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not generate ideas");
        return;
      }
      toast.success(
        `Ideas generated (${json?.createdCount ?? "—"} created)${
          json?.source === "fallback" ? " (templates)" : ""
        }`
      );
      setGenerateIdeasOpen(false);
      refresh();
    } finally {
      setGenerateIdeasSaving(false);
    }
  }

  async function generateContentFromIdea(entry: ContentEntryRow) {
    setGenerateContentSaving(true);
    try {
      const res = await fetch(
        `/api/t/${slug}/calendars/${entry.calendarId}/entries/${entry.id}/ai/generate-content`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not generate content");
        return;
      }
      toast.success(json?.source === "fallback" ? "Content generated (DRAFT via templates)" : "Content generated (DRAFT)");
      setEditingEntry(null);
      refresh();
    } finally {
      setGenerateContentSaving(false);
    }
  }

  const boardByStatus = useMemo(() => {
    const map = new Map<ContentEntryStatus, ContentEntryRow[]>();
    for (const s of STATUSES) map.set(s, []);
    if (!selected) return map;
    for (const e of selected.entries) {
      const st = (e.contentStatus ?? "DRAFT") as ContentEntryStatus;
      if (!map.has(st)) map.set(st, []);
      map.get(st)!.push(e);
    }
    return map;
  }, [selected]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-400 shrink-0" />
            Content Studio
          </h1>
          <p className="text-surface-400 text-sm mt-0.5">
            Channel calendars, editorial status, assignees, and approvals.{" "}
            <Link href={`/t/${slug}/calendar`} className="text-primary-400 hover:text-primary-300">
              Calendar
            </Link>{" "}
            shows scheduled dates alongside other work. Boards are channel calendars; archiving one removes it from Calendar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canCreateChannel && (
            <button
              type="button"
              onClick={() => setChannelOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-primary-600 hover:bg-primary-500 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New channel
            </button>
          )}
          <button
            type="button"
            onClick={() => setEntryOpen(true)}
            disabled={!selected}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface-700 hover:bg-surface-600 text-surface-100 border border-surface-600 disabled:opacity-40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New content
          </button>
          {aiEnabled && selected && (
            <button
              type="button"
              onClick={() => setGenerateIdeasOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-primary-600 hover:bg-primary-500 text-white transition-colors"
              title="Generate one IDEA per day for this channel board"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate ideas
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,220px)_1fr] gap-6">
        <aside className="space-y-3">
          <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Channels</p>
          {calendars.length === 0 ? (
            <p className="text-sm text-surface-500">No channel calendars yet. {canCreateChannel ? "Create one to get started." : "Ask an admin to add a channel."}</p>
          ) : (
            <ul className="space-y-1">
              {calendars.map((c) => {
                const on = c.id === selected?.id;
                return (
                  <li key={c.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "flex-1 w-full text-left rounded-xl px-3 py-2.5 text-sm border transition-all",
                        on ? "border-primary-500/50 bg-primary-500/10 text-surface-100" : "border-surface-700 bg-surface-800/80 text-surface-300 hover:border-surface-600"
                      )}
                      title={`Select board: ${c.name}`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="truncate font-medium">{c.name}</span>
                      </span>
                      {c.contentChannel && (
                        <span className="block text-[11px] text-surface-500 mt-0.5 truncate">
                          {c.contentChannel} · {c.entries.length} posts
                        </span>
                      )}
                      {!c.contentChannel && (
                        <span className="block text-[11px] text-surface-500 mt-0.5 truncate">{c.entries.length} posts</span>
                      )}
                      {c.members.length === 0 && (
                        <span
                          className="block text-[10px] text-surface-500 mt-1 truncate"
                          title="No explicit members: any Content Studio user with the add-on can edit until you restrict access."
                        >
                          Open to editors
                        </span>
                      )}
                    </button>
                    {canManageChannels && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          void deleteChannel(c.id);
                        }}
                        disabled={deletingChannelId === c.id}
                        className="p-2 rounded-xl text-surface-500 hover:text-red-400 hover:bg-surface-700 disabled:opacity-40 transition-colors"
                        title="Archive this board (removes it from the Calendar)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {selected && (
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-surface-600 text-surface-200 hover:bg-surface-800 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Members
            </button>
          )}
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-700 pb-3">
            {(
              [
                ["today", "Today", CalendarDays],
                ["table", "Table", List],
                ["board", "Board", LayoutGrid],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  tab === key ? "bg-primary-500 text-white" : "text-surface-400 hover:text-surface-200 hover:bg-surface-800"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {!selected ? (
            <p className="text-sm text-surface-500">Select or create a channel.</p>
          ) : tab === "today" ? (
            <div className="space-y-2">
              {todayEntries.length === 0 ? (
                <p className="text-sm text-surface-500">Nothing scheduled for today across your channels.</p>
              ) : (
                <ul className="divide-y divide-surface-700/80 rounded-2xl border border-surface-700 overflow-hidden">
                  {todayEntries.map((e) => (
                    <li key={e.id} className="px-4 py-3 bg-surface-800/50 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-surface-100 truncate">{e.title}</p>
                        <p className="text-[11px] text-surface-500">
                          {e._calendarName}
                          {e.contentStatus ? ` · ${STATUS_LABEL[e.contentStatus as ContentEntryStatus] ?? e.contentStatus}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingEntry(stripCalMeta(e))}
                        className="text-xs text-primary-400 hover:text-primary-300 shrink-0"
                      >
                        Open
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : tab === "table" ? (
            <div className="overflow-x-auto rounded-2xl border border-surface-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-850 text-left text-[11px] uppercase tracking-wider text-surface-500">
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Schedule</th>
                    <th className="px-4 py-3 font-semibold">Assignee</th>
                    <th className="px-4 py-3 font-semibold">Link</th>
                    <th className="px-4 py-3 font-semibold w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/80">
                  {tableEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-surface-500">
                        No content in this channel yet.
                      </td>
                    </tr>
                  ) : (
                    tableEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-surface-800/40">
                        <td className="px-4 py-3 text-surface-100 font-medium max-w-[220px] truncate">{e.title}</td>
                        <td className="px-4 py-3 text-surface-300">
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-700 text-surface-200">
                            {STATUS_LABEL[(e.contentStatus ?? "DRAFT") as ContentEntryStatus] ?? e.contentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-surface-400 whitespace-nowrap">
                          {format(parseISO(e.startAt), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3 text-surface-400">
                          {e.assignee ? nameOf(e.assignee) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {e.url ? (
                            <a
                              href={e.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary-400 hover:text-primary-300 text-xs"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEditingEntry(stripCalMeta(e))}
                            className="text-xs text-primary-400 hover:text-primary-300"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {STATUSES.map((st) => (
                <div key={st} className="min-w-[200px] max-w-[240px] flex-1 shrink-0 rounded-2xl border border-surface-700 bg-surface-850/40 p-2">
                  <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider px-2 py-1">
                    {STATUS_LABEL[st]}
                  </p>
                  <ul className="space-y-2 mt-2">
                    {(boardByStatus.get(st) ?? []).map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setEditingEntry(e)}
                          className="w-full text-left rounded-xl border border-surface-700 bg-surface-800 px-3 py-2 hover:border-surface-600 transition-colors"
                        >
                          <p className="text-xs font-medium text-surface-100 line-clamp-2">{e.title}</p>
                          <p className="text-[10px] text-surface-500 mt-0.5">{format(parseISO(e.startAt), "MMM d")}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {channelOpen && (
        <ModalWrap onClose={() => !channelSaving && setChannelOpen(false)}>
          <h2 className="text-lg font-semibold text-surface-100 mb-1">New channel calendar</h2>
          <p className="text-xs text-surface-500 mb-4">e.g. LinkedIn, Instagram — one calendar per surface.</p>
          <div className="space-y-3">
            <label className="block text-xs text-surface-500">Name</label>
            <input
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
              placeholder="LinkedIn"
            />
            <label className="block text-xs text-surface-500">Label (optional)</label>
            <input
              value={channelLabel}
              onChange={(e) => setChannelLabel(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
              placeholder="Shown as a tag"
            />
            <label className="block text-xs text-surface-500">Color</label>
            <input type="color" value={channelColor} onChange={(e) => setChannelColor(e.target.value)} className="h-10 w-14 rounded-lg border border-surface-700 bg-surface-900" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-4 py-2 rounded-xl text-xs text-surface-400 hover:bg-surface-700" onClick={() => setChannelOpen(false)} disabled={channelSaving}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createChannel()}
                disabled={channelSaving || !channelName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary-600 text-white disabled:opacity-40"
              >
                {channelSaving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </ModalWrap>
      )}

      {entryOpen && selected && (
        <ModalWrap onClose={() => !entrySaving && setEntryOpen(false)}>
          <h2 className="text-lg font-semibold text-surface-100 mb-4">New content — {selected.name}</h2>
          <div className="space-y-3">
            <input
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={entryNotes}
              onChange={(e) => setEntryNotes(e.target.value)}
              placeholder="Notes"
              rows={3}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-surface-500 block mb-1">Schedule</label>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="text-xs text-surface-500 block mb-1">Status</label>
                <select
                  value={entryStatus}
                  onChange={(e) => setEntryStatus(e.target.value as ContentEntryStatus)}
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-surface-500 mt-1">
                  Editor: IDEA / DRAFT / IN_REVIEW. Approver: APPROVED / READY_TO_PUBLISH / PUBLISHED / CANCELLED.
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs text-surface-500 block mb-1">Assignee</label>
              <select
                value={entryAssignee}
                onChange={(e) => setEntryAssignee(e.target.value)}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs"
              >
                <option value="">—</option>
                {companyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {nameOf(u)}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={entryUrl}
              onChange={(e) => setEntryUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
              title="Optional: the external URL for this content item (e.g. post draft, campaign page)."
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-4 py-2 rounded-xl text-xs text-surface-400 hover:bg-surface-700" onClick={() => setEntryOpen(false)} disabled={entrySaving}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createEntry()}
                disabled={entrySaving || !entryTitle.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary-600 text-white disabled:opacity-40"
              >
                {entrySaving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </ModalWrap>
      )}

      {generateIdeasOpen && selected && (
        <ModalWrap onClose={() => !generateIdeasSaving && setGenerateIdeasOpen(false)}>
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Generate ideas — {selected.name}</h2>
          <div className="space-y-3">
            <p className="text-xs text-surface-500">
              Creates <span className="text-surface-200 font-semibold">IDEA</span> entries date-wise for this channel. Later,
              open an idea and generate full content on demand.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-surface-500 block mb-1">Start date</label>
                <input
                  type="date"
                  value={generateIdeasStartDate}
                  onChange={(e) => setGenerateIdeasStartDate(e.target.value)}
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-surface-500 block mb-1">Days</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={generateIdeasDays}
                  onChange={(e) => setGenerateIdeasDays(Number(e.target.value))}
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs text-surface-400 hover:bg-surface-700"
                onClick={() => setGenerateIdeasOpen(false)}
                disabled={generateIdeasSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void generateIdeasForBoard()}
                disabled={generateIdeasSaving}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary-600 text-white disabled:opacity-40"
              >
                {generateIdeasSaving ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </ModalWrap>
      )}

      {membersOpen && selected && (
        <ModalWrap onClose={() => !memberSaving && setMembersOpen(false)}>
          <h2 className="text-lg font-semibold text-surface-100 mb-1">Members — {selected.name}</h2>
          <p className="text-xs text-surface-500 mb-4">VIEW / EDIT / PUBLISH / ADMIN. With no members, any Content Studio user can edit until you restrict access.</p>
          <ul className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {selected.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm bg-surface-900/80 rounded-lg px-3 py-2 border border-surface-700">
                <span className="text-surface-200 truncate">{nameOf(m.user)}</span>
                <span className="text-[11px] text-surface-500 shrink-0">{m.role}</span>
                <button
                  type="button"
                  onClick={() => void removeMember(m.userId)}
                  className="p-1 text-surface-500 hover:text-red-400"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
            {selected.members.length === 0 && <li className="text-sm text-surface-500">No explicit members (open to editors with Content Studio).</li>}
          </ul>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-surface-500 block mb-1">User</label>
              <select
                value={memberUserId}
                onChange={(e) => setMemberUserId(e.target.value)}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs"
              >
                <option value="">Select…</option>
                {companyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {nameOf(u)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="text-xs text-surface-500 block mb-1">Role</label>
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as typeof memberRole)}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs"
              >
                {(["VIEW", "EDIT", "PUBLISH", "ADMIN"] as const).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void addMember()}
              disabled={memberSaving || !memberUserId}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary-600 text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <div className="flex justify-end mt-4">
            <button type="button" className="px-4 py-2 rounded-xl text-xs text-surface-300 hover:bg-surface-700" onClick={() => setMembersOpen(false)}>
              Done
            </button>
          </div>
        </ModalWrap>
      )}

      {editingEntry && (
        <ModalWrap onClose={() => !editSaving && setEditingEntry(null)}>
          <h2 className="text-lg font-semibold text-surface-100 mb-4 truncate">Edit — {editingEntry.title}</h2>
          <div className="space-y-3">
            <input
              defaultValue={editingEntry.title}
              id="edit-title"
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              defaultValue={editingEntry.notes ?? ""}
              id="edit-notes"
              rows={3}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-surface-500 block mb-1">Schedule</label>
                <input
                  type="date"
                  defaultValue={format(parseISO(editingEntry.startAt), "yyyy-MM-dd")}
                  id="edit-date"
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-surface-500 block mb-1">Status</label>
                <select
                  defaultValue={(editingEntry.contentStatus ?? "DRAFT") as ContentEntryStatus}
                  id="edit-status"
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-surface-500 mt-1">
                  Selecting an approver status requires <span className="text-surface-200 font-medium">PUBLISH</span> access.
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs text-surface-500 block mb-1">Assignee</label>
              <select defaultValue={editingEntry.assigneeId ?? ""} id="edit-assignee" className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs">
                <option value="">—</option>
                {companyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {nameOf(u)}
                  </option>
                ))}
              </select>
            </div>
            <input
              defaultValue={editingEntry.url ?? ""}
              id="edit-url"
              placeholder="https://…"
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm"
              title="Optional external URL reviewers/openers can click."
            />
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => void deleteEntry(editingEntry)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <div className="flex gap-2">
                {editingEntry.contentStatus === "IDEA" && aiEnabled && (
                  <button
                    type="button"
                    onClick={() => void generateContentFromIdea(editingEntry)}
                    disabled={generateContentSaving}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 text-white disabled:opacity-40"
                    title="Generate full draft content based on this IDEA (AI)"
                  >
                    {generateContentSaving ? "Generating…" : "Generate content"}
                  </button>
                )}
                <button type="button" className="px-4 py-2 rounded-xl text-xs text-surface-400 hover:bg-surface-700" onClick={() => setEditingEntry(null)} disabled={editSaving}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => {
                    const titleEl = document.getElementById("edit-title") as HTMLInputElement | null;
                    const notesEl = document.getElementById("edit-notes") as HTMLTextAreaElement | null;
                    const dateEl = document.getElementById("edit-date") as HTMLInputElement | null;
                    const statusEl = document.getElementById("edit-status") as HTMLSelectElement | null;
                    const assignEl = document.getElementById("edit-assignee") as HTMLSelectElement | null;
                    const urlEl = document.getElementById("edit-url") as HTMLInputElement | null;
                    void patchEntry(editingEntry, {
                      title: titleEl?.value?.trim(),
                      notes: notesEl?.value ?? "",
                      startAt: dateEl?.value ? new Date(`${dateEl.value}T12:00:00`).toISOString() : undefined,
                      contentStatus: statusEl?.value,
                      assigneeId: assignEl?.value || null,
                      url: urlEl?.value?.trim() || null,
                    });
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary-600 text-white disabled:opacity-40"
                >
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </ModalWrap>
      )}
    </div>
  );
}

function ModalWrap({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]" onClick={onClose} role="presentation">
      <div
        className="bg-surface-800 border border-surface-700 rounded-2xl p-5 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="float-right p-1 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-700 mb-2" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
        <div className="clear-both">{children}</div>
      </div>
    </div>
  );
}
