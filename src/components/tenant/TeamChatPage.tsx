"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import LeaderQaPanel from "@/components/tenant/LeaderQaPanel";
import { User } from "@/types";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type ChannelType = "DM" | "GROUP";

interface PeerBrief {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
}

type GroupMemberRole = "MEMBER" | "ADMIN";

interface ChannelRow {
  id: string;
  name: string;
  slug: string;
  type: ChannelType;
  createdAt: string;
  displayName?: string;
  peer?: PeerBrief | null;
  /** Present for GROUP rows: your role (manage members / rename when ADMIN). */
  viewerRole?: GroupMemberRole;
  lastMessageAt?: string | null;
  lastPreview?: string | null;
}

interface GroupDetailsMember {
  userId: string;
  role: GroupMemberRole;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    username: string;
  };
}

interface ChatMediaAttachment {
  url: string;
  mimeType: string;
  kind: "image" | "video";
  fileName?: string;
}

interface Author {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
  username: string;
}

interface Message {
  id: string;
  body: string;
  createdAt: string;
  author: Author;
  attachments?: ChatMediaAttachment[];
}

interface Props {
  slug: string;
  currentUserId: string;
  /** Pinned LeaderGPT row + inline panel (matches leader-qa API entitlements). */
  showLeaderGptInChat?: boolean;
}

function sortChannelRows(rows: ChannelRow[]): ChannelRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.lastMessageAt
      ? new Date(a.lastMessageAt).getTime()
      : new Date(a.createdAt).getTime();
    const tb = b.lastMessageAt
      ? new Date(b.lastMessageAt).getTime()
      : new Date(b.createdAt).getTime();
    return tb - ta;
  });
}

function formatChatListTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isToday(d)) return format(d, "h:mm a");
    if (isYesterday(d)) return "Yesterday";
    return format(d, "M/d/yy");
  } catch {
    return "";
  }
}

function groupInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "G";
}

/** Matches server preview string so the list updates instantly after send. */
function buildPreviewFromMessage(m: Message): string {
  const parts: string[] = [];
  const t = m.body?.trim();
  if (t) parts.push(t.length > 72 ? `${t.slice(0, 70)}…` : t);
  const list = m.attachments ?? [];
  if (list.length > 0) {
    const imgs = list.filter((a) => a.kind === "image").length;
    const vids = list.filter((a) => a.kind === "video").length;
    const bits: string[] = [];
    if (imgs) bits.push(imgs === 1 ? "Photo" : `${imgs} photos`);
    if (vids) bits.push(vids === 1 ? "Video" : `${vids} videos`);
    if (bits.length) parts.push(bits.join(" · "));
  }
  return parts.join(" · ") || "Message";
}

export default function TeamChatPage({
  slug,
  currentUserId,
  showLeaderGptInChat = false,
}: Props) {
  const searchParams = useSearchParams();
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChannelRow | null>(null);
  const [leaderGptActive, setLeaderGptActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const [listSearch, setListSearch] = useState("");
  const [threadSearch, setThreadSearch] = useState("");
  const [isWide, setIsWide] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<Set<string>>(() => new Set());
  const [startingDm, setStartingDm] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupSettingsLoading, setGroupSettingsLoading] = useState(false);
  const [groupSettingsName, setGroupSettingsName] = useState("");
  const [groupSettingsMembers, setGroupSettingsMembers] = useState<GroupDetailsMember[]>([]);
  const [groupSettingsViewerRole, setGroupSettingsViewerRole] = useState<GroupMemberRole>("MEMBER");
  const [groupSettingsSearch, setGroupSettingsSearch] = useState("");
  const [groupSettingsSaving, setGroupSettingsSaving] = useState(false);
  const [stagedMedia, setStagedMedia] = useState<ChatMediaAttachment[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const loadChannels = useCallback(async () => {
    const res = await fetch(`/api/t/${slug}/chat/channels`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) {
      toast.error(j.error || "Could not load chats");
      return undefined;
    }
    const list: ChannelRow[] = j.data ?? [];
    setChannels(list);
    return list;
  }, [slug]);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    setGroupSettingsOpen(false);
  }, [selectedChannel?.id]);

  useEffect(() => {
    const loadUsers = async () => {
      const res = await fetch(`/api/t/${slug}/users`);
      const j = await res.json();
      if (!res.ok) return;
      setTeamMembers(j.data ?? []);
    };
    void loadUsers();
  }, [slug]);

  useEffect(() => {
    if (!showLeaderGptInChat) return;
    if (searchParams.get("ai") === "1") {
      setLeaderGptActive(true);
      setSelectedChannel(null);
      setMobileChatOpen(true);
    }
  }, [showLeaderGptInChat, searchParams]);

  useEffect(() => {
    if (channels.length === 0 || selectedChannel) return;
    if (showLeaderGptInChat && searchParams.get("ai") === "1") return;
    if (leaderGptActive) return;
    if (isWide) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, isWide, selectedChannel, showLeaderGptInChat, searchParams, leaderGptActive]);

  const filteredChannels = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    const base = !q
      ? channels
      : channels.filter((c) => {
          const label = (c.displayName ?? c.name ?? c.slug).toLowerCase();
          const prev = (c.lastPreview ?? "").toLowerCase();
          return label.includes(q) || c.slug.toLowerCase().includes(q) || prev.includes(q);
        });
    return sortChannelRows(base);
  }, [channels, listSearch]);

  /** Teammates matching the list search who are not already shown as a DM row (for "search org → start chat"). */
  const listSearchPeople = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return [];
    const dmPeerIdsShown = new Set(
      filteredChannels.filter((c) => c.type === "DM" && c.peer?.id).map((c) => c.peer!.id)
    );
    return teamMembers
      .filter((u) => u.id !== currentUserId)
      .filter((u) => !dmPeerIdsShown.has(u.id))
      .filter((u) => {
        const hay = `${u.firstName} ${u.lastName} ${u.email} ${u.username}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [teamMembers, listSearch, currentUserId, filteredChannels]);

  const handlePickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingMedia(true);
    try {
      for (const file of Array.from(files).slice(0, 8 - stagedMedia.length)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/upload?slug=${encodeURIComponent(slug)}&type=chat`, {
          method: "POST",
          body: fd,
        });
        const j = await res.json();
        if (!res.ok) {
          toast.error(j.error || "Upload failed");
          continue;
        }
        const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
        setStagedMedia((s) => [
          ...s,
          { url: j.url, mimeType: file.type, fileName: file.name, kind },
        ]);
      }
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const dmCandidates = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return teamMembers
      .filter((u) => u.id !== currentUserId)
      .filter((u) => {
        if (!q) return true;
        const name = `${u.firstName} ${u.lastName} ${u.email} ${u.username}`.toLowerCase();
        return name.includes(q);
      })
      .slice(0, 80);
  }, [teamMembers, memberSearch, currentUserId]);

  const groupPickerUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return teamMembers
      .filter((u) => u.id !== currentUserId)
      .filter((u) => {
        if (!q) return true;
        const name = `${u.firstName} ${u.lastName} ${u.email} ${u.username}`.toLowerCase();
        return name.includes(q);
      })
      .slice(0, 60);
  }, [teamMembers, memberSearch, currentUserId]);

  const messagesQueryKey = threadSearch.trim();

  useEffect(() => {
    if (!selectedChannel) return;
    let mounted = true;

    const loadMessages = async (showLoader: boolean) => {
      if (showLoader) setLoadingMessages(true);
      try {
        const q = messagesQueryKey ? `&q=${encodeURIComponent(messagesQueryKey)}` : "";
        const res = await fetch(
          `/api/t/${slug}/chat/channels/${selectedChannel.id}/messages?take=50${q}`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!res.ok) {
          if (showLoader) toast.error(j.error || "Could not load messages");
          return;
        }
        if (!mounted) return;
        const raw = j.data ?? [];
        const next: Message[] = raw.map((m: Message) => ({
          ...m,
          attachments: Array.isArray(m.attachments) ? m.attachments : [],
        }));
        setMessages((prev) => {
          if (
            prev.length === next.length &&
            prev[prev.length - 1]?.id === next[next.length - 1]?.id
          ) {
            return prev;
          }
          return next;
        });
      } finally {
        if (showLoader) setLoadingMessages(false);
      }
    };

    void loadMessages(true);
    const timer = setInterval(() => {
      if (messagesQueryKey) return;
      void loadMessages(false);
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [slug, selectedChannel?.id, messagesQueryKey]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if ((!text && stagedMedia.length === 0) || !selectedChannel) return;
    const channelId = selectedChannel.id;
    setSending(true);
    try {
      const res = await fetch(`/api/t/${slug}/chat/channels/${selectedChannel.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, attachments: stagedMedia }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not send message");
        return;
      }
      const created: Message = {
        ...j.data,
        attachments: Array.isArray(j.data?.attachments) ? j.data.attachments : [],
      };
      setMessages((prev) => [...prev, created]);
      setInput("");
      setStagedMedia([]);

      const preview = buildPreviewFromMessage(created);
      const lastAt = created.createdAt;
      setChannels((prev) =>
        sortChannelRows(
          prev.map((c) =>
            c.id === channelId ? { ...c, lastMessageAt: lastAt, lastPreview: preview } : c
          )
        )
      );
      setSelectedChannel((sel) =>
        sel && sel.id === channelId
          ? { ...sel, lastMessageAt: lastAt, lastPreview: preview }
          : sel
      );

      const list = await loadChannels();
      if (list) {
        const row = list.find((c) => c.id === channelId);
        if (row) setSelectedChannel(row);
      }
    } finally {
      setSending(false);
    }
  };

  const openChannel = (c: ChannelRow) => {
    setLeaderGptActive(false);
    setSelectedChannel(c);
    setThreadSearch("");
    if (!isWide) setMobileChatOpen(true);
  };

  const startDirectMessage = async (peer: User) => {
    setStartingDm(true);
    try {
      const res = await fetch(`/api/t/${slug}/chat/dm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerUserId: peer.id }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not start chat");
        return;
      }
      const ch: ChannelRow = {
        id: j.data.id,
        name: j.data.name,
        slug: j.data.slug,
        type: "DM",
        createdAt: j.data.createdAt ?? new Date().toISOString(),
        displayName: `${peer.firstName} ${peer.lastName}`,
        lastMessageAt: null,
        lastPreview: null,
        peer: {
          id: peer.id,
          firstName: peer.firstName,
          lastName: peer.lastName,
          avatarUrl: peer.avatarUrl,
          email: peer.email,
        },
      };
      setChannels((prev) => {
        if (prev.some((x) => x.id === ch.id)) return prev;
        return [ch, ...prev];
      });
      setLeaderGptActive(false);
      setSelectedChannel(ch);
      setNewChatOpen(false);
      setMemberSearch("");
      if (!isWide) setMobileChatOpen(true);
      toast.success(j.created ? "Chat started" : "Opening chat");
    } finally {
      setStartingDm(false);
    }
  };

  /** From main list search: open existing 1:1 or create DM (WhatsApp-style). */
  const openOrStartDirectMessage = async (peer: User) => {
    const existing = channels.find((c) => c.type === "DM" && c.peer?.id === peer.id);
    if (existing) {
      openChannel(existing);
      setListSearch("");
      return;
    }
    await startDirectMessage(peer);
    setListSearch("");
  };

  const createGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      toast.error("Enter a group name");
      return;
    }
    const ids = Array.from(groupMemberIds);
    if (ids.length < 1) {
      toast.error("Select at least one person");
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await fetch(`/api/t/${slug}/chat/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, memberUserIds: ids }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not create group");
        return;
      }
      const d = j.data;
      const ch: ChannelRow = {
        id: d.id,
        name: d.name,
        slug: d.slug,
        type: "GROUP",
        createdAt: d.createdAt ?? new Date().toISOString(),
        viewerRole: "ADMIN",
        lastMessageAt: null,
        lastPreview: null,
      };
      setChannels((prev) => [ch, ...prev]);
      setLeaderGptActive(false);
      setSelectedChannel(ch);
      setNewGroupOpen(false);
      setGroupName("");
      setGroupMemberIds(new Set());
      setMemberSearch("");
      if (!isWide) setMobileChatOpen(true);
      toast.success("Group created");
      await loadChannels();
    } finally {
      setCreatingGroup(false);
    }
  };

  const toggleGroupMember = (id: string) => {
    setGroupMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadGroupSettings = useCallback(
    async (channelId: string) => {
      setGroupSettingsLoading(true);
      try {
        const res = await fetch(`/api/t/${slug}/chat/groups/${channelId}`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) {
          toast.error(j.error || "Could not load group");
          return false;
        }
        const d = j.data;
        setGroupSettingsName(d.name ?? "");
        setGroupSettingsMembers(d.members ?? []);
        setGroupSettingsViewerRole(d.viewerRole ?? "MEMBER");
        return true;
      } finally {
        setGroupSettingsLoading(false);
      }
    },
    [slug]
  );

  const openGroupSettings = () => {
    if (!selectedChannel || selectedChannel.type !== "GROUP") return;
    setGroupSettingsSearch("");
    setGroupSettingsOpen(true);
    void loadGroupSettings(selectedChannel.id);
  };

  const saveGroupName = async () => {
    if (!selectedChannel || selectedChannel.type !== "GROUP") return;
    const name = groupSettingsName.trim();
    if (!name) {
      toast.error("Enter a name");
      return;
    }
    setGroupSettingsSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/chat/groups/${selectedChannel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not update");
        return;
      }
      const updatedName = j.data?.name ?? name;
      setChannels((prev) =>
        prev.map((c) => (c.id === selectedChannel.id ? { ...c, name: updatedName } : c))
      );
      setSelectedChannel((sel) =>
        sel && sel.id === selectedChannel.id ? { ...sel, name: updatedName } : sel
      );
      toast.success("Group name updated");
    } finally {
      setGroupSettingsSaving(false);
    }
  };

  const addPersonToGroup = async (user: User) => {
    if (!selectedChannel || selectedChannel.type !== "GROUP") return;
    setGroupSettingsSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/chat/groups/${selectedChannel.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not add");
        return;
      }
      toast.success(`${user.firstName} added`);
      setGroupSettingsSearch("");
      await loadGroupSettings(selectedChannel.id);
      await loadChannels();
    } finally {
      setGroupSettingsSaving(false);
    }
  };

  const patchMemberRole = async (userId: string, role: GroupMemberRole) => {
    if (!selectedChannel || selectedChannel.type !== "GROUP") return;
    setGroupSettingsSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/chat/groups/${selectedChannel.id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not update role");
        return;
      }
      await loadGroupSettings(selectedChannel.id);
      await loadChannels();
      if (userId === currentUserId) {
        setGroupSettingsViewerRole(role);
        setChannels((prev) =>
          prev.map((c) => (c.id === selectedChannel.id ? { ...c, viewerRole: role } : c))
        );
        setSelectedChannel((sel) =>
          sel && sel.id === selectedChannel.id ? { ...sel, viewerRole: role } : sel
        );
      }
    } finally {
      setGroupSettingsSaving(false);
    }
  };

  const removeOrLeaveMember = async (userId: string) => {
    if (!selectedChannel || selectedChannel.type !== "GROUP") return;
    setGroupSettingsSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/chat/groups/${selectedChannel.id}/members/${userId}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not remove");
        return;
      }
      if (j.data?.channelDeleted) {
        setGroupSettingsOpen(false);
        setSelectedChannel(null);
        setLeaderGptActive(false);
        if (!isWide) setMobileChatOpen(false);
        await loadChannels();
        toast.success("Group ended");
        return;
      }
      if (userId === currentUserId) {
        setGroupSettingsOpen(false);
        setSelectedChannel(null);
        setLeaderGptActive(false);
        if (!isWide) setMobileChatOpen(false);
        await loadChannels();
        toast.success("You left the group");
        return;
      }
      toast.success("Removed from group");
      await loadGroupSettings(selectedChannel.id);
      await loadChannels();
    } finally {
      setGroupSettingsSaving(false);
    }
  };

  const groupSettingsAddCandidates = useMemo(() => {
    const q = groupSettingsSearch.trim().toLowerCase();
    const inGroup = new Set(groupSettingsMembers.map((m) => m.userId));
    return teamMembers
      .filter((u) => u.id !== currentUserId && !inGroup.has(u.id))
      .filter((u) => {
        if (!q) return true;
        const hay = `${u.firstName} ${u.lastName} ${u.email} ${u.username}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [teamMembers, groupSettingsSearch, currentUserId, groupSettingsMembers]);

  const channelTitle = selectedChannel
    ? selectedChannel.type === "DM"
      ? selectedChannel.displayName ?? selectedChannel.name
      : selectedChannel.name
    : "Chats";

  const channelSubtitle = selectedChannel
    ? selectedChannel.type === "DM"
      ? "Direct message"
      : selectedChannel.viewerRole === "ADMIN"
        ? "Group · You manage"
        : "Group"
    : "";

  const showChatPane = Boolean(
    (selectedChannel || (leaderGptActive && showLeaderGptInChat)) && (isWide || mobileChatOpen)
  );
  const showListPane = isWide || !mobileChatOpen;

  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row flex-1 min-h-0 h-full overflow-hidden",
        "[font-family:system-ui,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif]",
        "bg-surface-950 text-slate-900 dark:bg-[#13101c] dark:text-[#e9edef]"
      )}
    >
      {/* Conversation list */}
      <aside
        className={cn(
          "flex flex-col border-r border-slate-200/90 bg-surface-900 dark:border-[#2a2538] dark:bg-[#13101c] min-h-0 shrink-0",
          "w-full lg:w-[min(100%,420px)] lg:max-w-[420px]",
          showListPane ? "flex" : "hidden lg:flex"
        )}
      >
        <div className="px-3 py-3 border-b border-slate-200/90 bg-surface-800/90 dark:border-[#2a2538] dark:bg-[#1c1828] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-[19px] font-semibold tracking-tight text-slate-900 dark:text-[#e9edef]">Chats</h1>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setNewGroupOpen(true);
                  setGroupName("");
                  setGroupMemberIds(new Set());
                  setMemberSearch("");
                }}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-200/90 hover:text-slate-900 dark:text-[#9ca0b8] dark:hover:bg-[#2a2538] dark:hover:text-[#e9edef]"
                title="New group"
                aria-label="New group"
              >
                <Users className="w-[22px] h-[22px]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewChatOpen(true);
                  setMemberSearch("");
                }}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-200/90 hover:text-slate-900 dark:text-[#9ca0b8] dark:hover:bg-[#2a2538] dark:hover:text-[#e9edef]"
                title="New chat"
                aria-label="New chat"
              >
                <MessageCircle className="w-[22px] h-[22px]" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#9ca0b8] pointer-events-none" />
            <input
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search chats or people in your org"
              className="w-full rounded-lg bg-white border border-slate-200 pl-10 pr-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-[#1c1828] dark:border-0 dark:text-[#e9edef] dark:placeholder:text-[#9ca0b8]"
            />
          </div>
        </div>

        {showLeaderGptInChat && (
          <div className="shrink-0 border-b border-slate-200/90 px-2 py-1.5 bg-surface-900 dark:border-[#2a2538] dark:bg-[#13101c]">
            <button
              type="button"
              onClick={() => {
                setLeaderGptActive(true);
                setSelectedChannel(null);
                setThreadSearch("");
                if (!isWide) setMobileChatOpen(true);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors border border-transparent",
                leaderGptActive
                  ? "bg-slate-200/90 border-primary-500/40 dark:bg-[#2a2538]"
                  : "hover:bg-surface-800/80 dark:hover:bg-[#1c1828]"
              )}
            >
              <div
                className="w-[49px] h-[49px] rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                aria-hidden
              >
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-medium text-slate-900 dark:text-[#e9edef] leading-tight">LeaderGPT</p>
                <p className="text-[13px] text-slate-500 dark:text-[#9ca0b8] mt-0.5 leading-snug">Leadership Q&amp;A and task actions</p>
              </div>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredChannels.length === 0 && (
            <p className="text-[13px] text-slate-500 dark:text-[#9ca0b8] px-4 py-8 text-center leading-relaxed">
              {channels.length === 0
                ? "No chats yet. Start a direct message or create a group."
                : "No matches."}
            </p>
          )}
          <ul className="py-0">
            {filteredChannels.map((c) => {
              const active = selectedChannel?.id === c.id && !leaderGptActive;
              const label = c.type === "DM" ? c.displayName ?? c.name : c.name;
              const timeStr = formatChatListTime(c.lastMessageAt ?? undefined);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openChannel(c)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-slate-200/50 dark:border-[#00000018]",
                      active ? "bg-slate-200/90 dark:bg-[#2a2538]" : "hover:bg-surface-800/80 dark:hover:bg-[#1c1828]"
                    )}
                  >
                    {c.type === "DM" && c.peer ? (
                      <Avatar
                        firstName={c.peer.firstName}
                        lastName={c.peer.lastName}
                        avatarUrl={c.peer.avatarUrl}
                        size="md"
                        className="flex-shrink-0 w-[49px] h-[49px] [&>span]:text-[16px]"
                      />
                    ) : (
                      <div
                        className="w-[49px] h-[49px] rounded-full flex items-center justify-center flex-shrink-0 text-[17px] font-medium bg-primary-600/90 text-white dark:bg-[#5b5470]"
                        aria-hidden
                      >
                        {groupInitials(c.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[16px] font-medium text-slate-900 dark:text-[#e9edef] truncate leading-tight">{label}</p>
                        <p className="text-[13px] text-slate-500 dark:text-[#9ca0b8] truncate mt-0.5 leading-snug">
                          {c.lastPreview ?? (c.type === "DM" ? "Tap to message" : "No messages yet")}
                        </p>
                      </div>
                      {timeStr && (
                        <span className="text-[11px] text-slate-400 dark:text-[#9ca0b8] flex-shrink-0 pt-0.5 whitespace-nowrap">
                          {timeStr}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {listSearch.trim() && listSearchPeople.length > 0 && (
            <div className="border-t border-slate-200/90 dark:border-[#2a2538] mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9ca0b8] px-3 pt-3 pb-1">
                People in your organization
              </p>
              <ul className="pb-2">
                {listSearchPeople.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={startingDm}
                      onClick={() => void openOrStartDirectMessage(u)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        "hover:bg-surface-800/80 dark:hover:bg-[#1c1828] border-b border-slate-200/50 dark:border-[#00000018]",
                        startingDm && "opacity-60 pointer-events-none"
                      )}
                    >
                      <Avatar
                        firstName={u.firstName}
                        lastName={u.lastName}
                        avatarUrl={u.avatarUrl}
                        size="md"
                        className="flex-shrink-0 w-[49px] h-[49px]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[16px] font-medium text-slate-900 dark:text-[#e9edef] truncate leading-tight">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-[13px] text-slate-500 dark:text-[#9ca0b8] truncate">{u.email}</p>
                      </div>
                      <span className="text-[12px] text-primary-400 flex-shrink-0 font-medium">Message</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section
        className={cn(
          "chat-thread-pane flex flex-col flex-1 min-w-0 min-h-0 relative",
          showChatPane ? "flex" : "hidden lg:flex"
        )}
      >
        {!selectedChannel && !leaderGptActive && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12 bg-white/80 backdrop-blur-[2px] dark:bg-[#1f1c2c]/85">
            <div className="w-20 h-20 rounded-full bg-primary-500/15 dark:bg-primary-500/20 flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-primary-600/80 dark:text-[#9ca0b8]" />
            </div>
            <p className="text-[20px] font-light text-slate-900 dark:text-[#e9edef] tracking-tight">Team chat</p>
            <p className="text-[13px] text-slate-500 dark:text-[#9ca0b8] mt-2 max-w-sm leading-relaxed">
              Select a chat, open LeaderGPT above, or start a new conversation.
            </p>
          </div>
        )}

        {leaderGptActive && showLeaderGptInChat && showChatPane && (
          <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-surface-950 dark:bg-[#0f0d16]">
            <LeaderQaPanel
              slug={slug}
              variant="inline"
              onClose={
                !isWide
                  ? () => {
                      setLeaderGptActive(false);
                      setMobileChatOpen(false);
                    }
                  : undefined
              }
            />
          </div>
        )}

        {selectedChannel && showChatPane && !leaderGptActive && (
          <>
            <header className="flex items-center gap-2 px-2 py-2 pl-1 border-b border-slate-200/90 bg-surface-900/95 dark:border-[#2a2538] dark:bg-[#1c1828] shrink-0 min-h-[56px]">
              <button
                type="button"
                className="lg:hidden p-2 rounded-full text-slate-800 hover:bg-slate-200/90 dark:text-[#e9edef] dark:hover:bg-[#2a2538]"
                onClick={() => setMobileChatOpen(false)}
                aria-label="Back to chats"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              {selectedChannel.type === "DM" && selectedChannel.peer ? (
                <Avatar
                  firstName={selectedChannel.peer.firstName}
                  lastName={selectedChannel.peer.lastName}
                  avatarUrl={selectedChannel.peer.avatarUrl}
                  size="md"
                  className="flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[15px] font-semibold bg-primary-600/85 text-white dark:bg-[#5b5470]">
                  {groupInitials(selectedChannel.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-medium text-slate-900 dark:text-[#e9edef] truncate leading-tight">{channelTitle}</p>
                <p className="text-[12px] text-slate-500 dark:text-[#9ca0b8] truncate">{channelSubtitle}</p>
              </div>
              <div className="flex items-center gap-1 pr-1">
                {selectedChannel.type === "GROUP" && (
                  <button
                    type="button"
                    onClick={() => openGroupSettings()}
                    className="p-2 rounded-full text-slate-500 hover:bg-slate-200/90 hover:text-slate-900 dark:text-[#9ca0b8] dark:hover:bg-[#2a2538] dark:hover:text-[#e9edef]"
                    title="Group info"
                    aria-label="Group info"
                  >
                    <Settings2 className="w-5 h-5" />
                  </button>
                )}
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-[#9ca0b8]" />
                  <input
                    type="search"
                    value={threadSearch}
                    onChange={(e) => setThreadSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="Search in chat"
                    className="w-36 lg:w-44 rounded-lg bg-white border border-slate-200 pl-8 pr-2 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-[#2a2538] dark:border-0 dark:text-[#e9edef] dark:placeholder:text-[#9ca0b8]"
                  />
                </div>
              </div>
            </header>

            <div className="sm:hidden px-2 py-2 bg-surface-900/95 border-b border-slate-200/90 dark:bg-[#1c1828] dark:border-[#2a2538] flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 dark:text-[#9ca0b8] flex-shrink-0" />
              <input
                type="search"
                value={threadSearch}
                onChange={(e) => setThreadSearch(e.target.value)}
                placeholder="Search messages in this chat"
                className="flex-1 rounded-lg bg-white border border-slate-200 px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-[#2a2538] dark:border-0 dark:text-[#e9edef] dark:placeholder:text-[#9ca0b8]"
              />
            </div>

            <div ref={messagesRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0">
              {loadingMessages && (
                <p className="text-[13px] text-slate-500 dark:text-[#9ca0b8] text-center py-4">Loading…</p>
              )}
              {!loadingMessages && messages.length === 0 && (
                <p className="text-[13px] text-slate-500 dark:text-[#9ca0b8] italic text-center py-8">
                  {messagesQueryKey ? "No messages match your search." : "No messages yet."}
                </p>
              )}
              {messages.map((m) => {
                const mine = m.author.id === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={cn("flex gap-1.5", mine ? "justify-end" : "justify-start")}
                  >
                    {!mine && (
                      <Avatar
                        firstName={m.author.firstName}
                        lastName={m.author.lastName}
                        avatarUrl={m.author.avatarUrl}
                        size="xs"
                        className="flex-shrink-0 mt-0.5 w-7 h-7"
                      />
                    )}
                    <div
                      className={cn(
                        "max-w-[min(92%,480px)] px-2 py-1.5 shadow-sm",
                        mine
                          ? "bg-primary-600 text-white dark:bg-primary-800 dark:text-[#e9edef] rounded-[7px] rounded-br-[2px]"
                          : "bg-white text-slate-900 rounded-[7px] rounded-bl-[2px] border border-slate-200/90 shadow-sm dark:bg-[#1c1828] dark:text-[#e9edef] dark:border-[#00000022]"
                      )}
                    >
                      {!mine && selectedChannel.type === "GROUP" && (
                        <p className="text-[12px] font-semibold text-primary-700 dark:text-primary-400 mb-0.5">
                          {m.author.firstName} {m.author.lastName}
                        </p>
                      )}
                      {(m.attachments?.length ?? 0) > 0 && (
                        <div className="flex flex-col gap-1.5 mb-1">
                          {m.attachments!.map((a, i) =>
                            a.kind === "image" ? (
                              <a
                                key={i}
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "block rounded overflow-hidden max-w-[min(100%,280px)]",
                                  mine ? "ring-1 ring-white/20" : "ring-1 ring-slate-200 dark:ring-[#2a2538]"
                                )}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.url} alt="" className="max-h-52 w-full object-cover" />
                              </a>
                            ) : (
                              <video
                                key={i}
                                src={a.url}
                                controls
                                className="max-w-[min(100%,300px)] rounded max-h-56"
                              />
                            )
                          )}
                        </div>
                      )}
                      {m.body?.trim() ? (
                        <p className="text-[14.2px] whitespace-pre-wrap break-words leading-[1.45]">{m.body}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-200/90 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-surface-900/95 dark:border-[#2a2538] dark:bg-[#1c1828] shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                multiple
                onChange={(e) => void handlePickFiles(e.target.files)}
              />
              {stagedMedia.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {stagedMedia.map((a, i) => (
                    <div key={`${a.url}-${i}`} className="relative">
                      {a.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt="" className="h-14 w-14 object-cover rounded-md ring-1 ring-slate-200 dark:ring-[#2a2538]" />
                      ) : (
                        <video src={a.url} className="h-14 w-14 object-cover rounded-md ring-1 ring-slate-200 dark:ring-[#2a2538]" muted />
                      )}
                      <button
                        type="button"
                        onClick={() => setStagedMedia((s) => s.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-surface-900 border border-slate-200 text-slate-700 dark:bg-[#13101c] dark:border-[#2a2538] dark:text-[#e9edef] flex items-center justify-center"
                        aria-label="Remove attachment"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingMedia || stagedMedia.length >= 8 || sending}
                  className={cn(
                    "rounded-full p-2 flex items-center justify-center flex-shrink-0",
                    uploadingMedia || stagedMedia.length >= 8
                      ? "text-slate-400 cursor-not-allowed dark:text-[#64748b]"
                      : "text-slate-500 hover:bg-slate-200/90 hover:text-slate-900 dark:text-[#9ca0b8] dark:hover:bg-[#2a2538] dark:hover:text-[#e9edef]"
                  )}
                  title="Attach"
                >
                  <Paperclip className="w-6 h-6" />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() || stagedMedia.length > 0) void send();
                    }
                  }}
                  placeholder={stagedMedia.length ? "Caption" : "Type a message"}
                  rows={1}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none max-h-32 min-w-0 dark:bg-[#2a2538] dark:border-0 dark:text-[#e9edef] dark:placeholder:text-[#9ca0b8]"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={(!input.trim() && stagedMedia.length === 0) || sending || uploadingMedia}
                  className={cn(
                    "rounded-full p-2.5 flex items-center justify-center flex-shrink-0",
                    (input.trim() || stagedMedia.length > 0) && !sending && !uploadingMedia
                      ? "bg-primary-600 text-white hover:bg-primary-500"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-[#2a2538] dark:text-[#64748b]"
                  )}
                  aria-label="Send"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <Modal
        isOpen={newChatOpen}
        onClose={() => {
          setNewChatOpen(false);
          setMemberSearch("");
        }}
        title="New chat"
        description="Search anyone in your organization by name, email, or username, then tap to start chatting."
        size="sm"
      >
        <div className="space-y-3 [font-family:system-ui,sans-serif]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input
              type="search"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search people in your organization…"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-surface-700/80">
            {dmCandidates.length === 0 && (
              <p className="text-xs text-surface-500 py-6 text-center">No people match.</p>
            )}
            {dmCandidates.map((u) => (
              <button
                key={u.id}
                type="button"
                disabled={startingDm}
                onClick={() => void startDirectMessage(u)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-800 text-left transition-colors"
              >
                <Avatar firstName={u.firstName} lastName={u.lastName} avatarUrl={u.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-100 truncate">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-[11px] text-surface-500 truncate">{u.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={newGroupOpen}
        onClose={() => {
          setNewGroupOpen(false);
          setGroupName("");
          setGroupMemberIds(new Set());
          setMemberSearch("");
        }}
        title="New group"
        description="Add a name and choose who to include."
        size="sm"
      >
        <div className="space-y-3 [font-family:system-ui,sans-serif]">
          <div>
            <label className="block text-[11px] text-surface-500 mb-1">Group name</label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Project Alpha"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input
              type="search"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search people to add"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1 rounded-xl border border-surface-700/80">
            {groupPickerUsers.length === 0 && (
              <p className="text-xs text-surface-500 py-6 text-center">No people match.</p>
            )}
            {groupPickerUsers.map((u) => {
              const checked = groupMemberIds.has(u.id);
              return (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-surface-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleGroupMember(u.id)}
                    className="rounded border-surface-600 text-primary-600 focus:ring-primary-500"
                  />
                  <Avatar firstName={u.firstName} lastName={u.lastName} avatarUrl={u.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-100 truncate">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-[11px] text-surface-500 truncate">{u.email}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            disabled={creatingGroup || !groupName.trim() || groupMemberIds.size < 1}
            onClick={() => void createGroup()}
            className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingGroup ? "Creating…" : "Create group"}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={groupSettingsOpen}
        onClose={() => {
          setGroupSettingsOpen(false);
          setGroupSettingsSearch("");
        }}
        title="Group info"
        description="Admins can rename the group, add or remove people, and assign admins."
        size="sm"
      >
        <div className="space-y-4 [font-family:system-ui,sans-serif]">
          {groupSettingsLoading ? (
            <p className="text-sm text-surface-500 py-6 text-center">Loading…</p>
          ) : (
            <>
              <div>
                <label className="block text-[11px] text-surface-500 mb-1">Group name</label>
                <div className="flex gap-2">
                  <input
                    value={groupSettingsName}
                    onChange={(e) => setGroupSettingsName(e.target.value)}
                    disabled={groupSettingsViewerRole !== "ADMIN" || groupSettingsSaving}
                    className="flex-1 bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 disabled:opacity-60"
                  />
                  {groupSettingsViewerRole === "ADMIN" && (
                    <button
                      type="button"
                      disabled={groupSettingsSaving || !groupSettingsName.trim()}
                      onClick={() => void saveGroupName()}
                      className="px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 disabled:opacity-50"
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>

              {groupSettingsViewerRole === "ADMIN" && (
                <div>
                  <label className="block text-[11px] text-surface-500 mb-1">Add people</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
                    <input
                      type="search"
                      value={groupSettingsSearch}
                      onChange={(e) => setGroupSettingsSearch(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-surface-700/80 divide-y divide-surface-800">
                    {groupSettingsAddCandidates.length === 0 && (
                      <p className="text-xs text-surface-500 py-4 text-center px-2">
                        {groupSettingsSearch.trim() ? "No matches." : "Everyone is already here."}
                      </p>
                    )}
                    {groupSettingsAddCandidates.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        disabled={groupSettingsSaving}
                        onClick={() => void addPersonToGroup(u)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-800 text-left transition-colors"
                      >
                        <Avatar firstName={u.firstName} lastName={u.lastName} avatarUrl={u.avatarUrl} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-100 truncate">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-[11px] text-surface-500 truncate">{u.email}</p>
                        </div>
                        <span className="text-xs text-primary-400 font-medium">Add</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="block text-[11px] text-surface-500 mb-2">
                  Members ({groupSettingsMembers.length})
                </p>
                <ul className="max-h-56 overflow-y-auto rounded-xl border border-surface-700/80 divide-y divide-surface-800">
                  {groupSettingsMembers.map((m) => {
                    const groupAdminCount = groupSettingsMembers.filter((x) => x.role === "ADMIN").length;
                    const isSelf = m.userId === currentUserId;
                    const canManage = groupSettingsViewerRole === "ADMIN" && !isSelf;
                    return (
                      <li
                        key={m.userId}
                        className="flex items-center gap-2 px-3 py-2.5"
                      >
                        <Avatar
                          firstName={m.user.firstName}
                          lastName={m.user.lastName}
                          avatarUrl={m.user.avatarUrl}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-100 truncate">
                            {m.user.firstName} {m.user.lastName}
                            {isSelf ? " (you)" : ""}
                          </p>
                          <p className="text-[11px] text-surface-500 truncate">{m.user.email}</p>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md shrink-0",
                            m.role === "ADMIN"
                              ? "bg-primary-500/20 text-primary-300"
                              : "bg-surface-700 text-surface-400"
                          )}
                        >
                          {m.role === "ADMIN" ? "Admin" : "Member"}
                        </span>
                        {canManage && (
                          <div className="flex flex-col gap-1 items-end shrink-0">
                            {m.role === "MEMBER" ? (
                              <button
                                type="button"
                                disabled={groupSettingsSaving}
                                onClick={() => void patchMemberRole(m.userId, "ADMIN")}
                                className="text-[11px] text-primary-400 hover:text-primary-300"
                              >
                                Make admin
                              </button>
                            ) : (
                              groupAdminCount > 1 && (
                                <button
                                  type="button"
                                  disabled={groupSettingsSaving}
                                  onClick={() => void patchMemberRole(m.userId, "MEMBER")}
                                  className="text-[11px] text-surface-400 hover:text-surface-200"
                                >
                                  Remove admin
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              disabled={groupSettingsSaving}
                              onClick={() => void removeOrLeaveMember(m.userId)}
                              className="text-[11px] text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <button
                type="button"
                disabled={groupSettingsSaving}
                onClick={() => void removeOrLeaveMember(currentUserId)}
                className="w-full py-2.5 rounded-xl border border-red-500/40 text-red-400 text-sm font-medium hover:bg-red-500/10"
              >
                Leave group
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
