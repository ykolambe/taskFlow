"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Hash,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { User } from "@/types";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type ChannelType = "GLOBAL" | "ROLE" | "CUSTOM" | "DM";

interface PeerBrief {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
}

interface ChannelRow {
  id: string;
  name: string;
  slug: string;
  type: ChannelType;
  createdAt: string;
  displayName?: string;
  peer?: PeerBrief | null;
  lastMessageAt?: string | null;
  lastPreview?: string | null;
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
}

export default function TeamChatPage({ slug, currentUserId }: Props) {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChannelRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const [listSearch, setListSearch] = useState("");
  const [isWide, setIsWide] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [startingDm, setStartingDm] = useState(false);
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
    const res = await fetch(`/api/t/${slug}/chat/channels`);
    const j = await res.json();
    if (!res.ok) {
      toast.error(j.error || "Could not load channels");
      return;
    }
    const list: ChannelRow[] = j.data ?? [];
    setChannels(list);
    return list;
  }, [slug]);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

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
    if (channels.length === 0 || selectedChannel) return;
    if (isWide) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, isWide, selectedChannel]);

  const filteredChannels = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    const base = !q
      ? channels
      : channels.filter((c) => {
          const label = (c.displayName ?? c.name ?? c.slug).toLowerCase();
          return label.includes(q) || c.slug.toLowerCase().includes(q);
        });
    return [...base].sort((a, b) => {
      const ta = a.lastMessageAt
        ? new Date(a.lastMessageAt).getTime()
        : new Date(a.createdAt).getTime();
      const tb = b.lastMessageAt
        ? new Date(b.lastMessageAt).getTime()
        : new Date(b.createdAt).getTime();
      return tb - ta;
    });
  }, [channels, listSearch]);

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
      .slice(0, 40);
  }, [teamMembers, memberSearch, currentUserId]);

  useEffect(() => {
    if (!selectedChannel) return;
    let mounted = true;

    const loadMessages = async (showLoader: boolean) => {
      if (showLoader) setLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/t/${slug}/chat/channels/${selectedChannel.id}/messages?take=50`,
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
      void loadMessages(false);
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [slug, selectedChannel?.id]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if ((!text && stagedMedia.length === 0) || !selectedChannel) return;
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
      void loadChannels();
    } finally {
      setSending(false);
    }
  };

  const openChannel = (c: ChannelRow) => {
    setSelectedChannel(c);
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
      setSelectedChannel(ch);
      setNewChatOpen(false);
      setMemberSearch("");
      if (!isWide) setMobileChatOpen(true);
      toast.success(j.created ? "Chat started" : "Opening chat");
    } finally {
      setStartingDm(false);
    }
  };

  const channelTitle = selectedChannel
    ? selectedChannel.type === "DM"
      ? selectedChannel.displayName ?? selectedChannel.name
      : `#${selectedChannel.slug}`
    : "Chat";

  const showChatPane = Boolean(selectedChannel && (isWide || mobileChatOpen));
  const showListPane = isWide || !mobileChatOpen;

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 h-full">
      {/* Channel list — WhatsApp-style on mobile (list first) */}
      <aside
        className={cn(
          "flex flex-col border-r border-surface-800 bg-surface-900/90 min-h-0 shrink-0",
          "w-full lg:w-[min(100%,380px)] lg:max-w-[380px]",
          showListPane ? "flex" : "hidden lg:flex"
        )}
      >
        <div className="px-3 py-3 border-b border-surface-800 space-y-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-surface-100">Team Chat</p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search channels & names…"
              className="w-full bg-surface-800/80 border border-surface-700 rounded-xl pl-9 pr-3 py-2 text-xs text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="w-full justify-center gap-2"
            onClick={() => setNewChatOpen(true)}
          >
            <UserPlus className="w-3.5 h-3.5" />
            New message
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredChannels.length === 0 && (
            <p className="text-[11px] text-surface-500 px-3 py-4 text-center">
              {channels.length === 0 ? "No channels yet." : "No matches."}
            </p>
          )}
          <ul className="p-1.5 space-y-0.5">
            {filteredChannels.map((c) => {
              const active = selectedChannel?.id === c.id;
              const label = c.type === "DM" ? c.displayName ?? c.name : c.name;
              const kindLabel =
                c.type === "DM"
                  ? "Direct"
                  : c.type === "GLOBAL"
                    ? "Channel · Everyone"
                    : c.type === "ROLE"
                      ? "Channel · Role"
                      : "Channel";
              const accent =
                c.type === "DM"
                  ? {
                      bar: "border-l-violet-500",
                      chip: "bg-violet-500/20 text-violet-300 border-violet-500/35",
                      activeBg: "bg-violet-500/15",
                    }
                  : {
                      bar: "border-l-emerald-500",
                      chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/35",
                      activeBg: "bg-emerald-500/15",
                    };
              const timeAgo =
                c.lastMessageAt &&
                (() => {
                  try {
                    return formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true });
                  } catch {
                    return null;
                  }
                })();
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openChannel(c)}
                    className={cn(
                      "w-full flex items-center gap-2.5 pl-2 pr-2.5 py-2.5 rounded-xl text-left transition-colors border-l-[3px]",
                      accent.bar,
                      active ? cn("border border-surface-600/80", accent.activeBg) : "border border-transparent hover:bg-surface-800/80"
                    )}
                  >
                    {c.type === "DM" && c.peer ? (
                      <Avatar
                        firstName={c.peer.firstName}
                        lastName={c.peer.lastName}
                        avatarUrl={c.peer.avatarUrl}
                        size="sm"
                        className="flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-750 flex items-center justify-center flex-shrink-0 ring-1 ring-emerald-500/25">
                        <Hash className="w-4 h-4 text-emerald-400/90" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium text-surface-100 truncate">{label}</p>
                        {timeAgo && (
                          <span className="text-[10px] text-surface-600 flex-shrink-0">{timeAgo}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        <span
                          className={cn(
                            "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0",
                            accent.chip
                          )}
                        >
                          {kindLabel}
                        </span>
                        <p className="text-[10px] text-surface-500 truncate">
                          {c.lastPreview ?? (c.type === "DM" ? "Direct message" : "No messages yet")}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Messages */}
      <section
        className={cn(
          "flex flex-col flex-1 min-w-0 min-h-0 bg-surface-950/40",
          showChatPane ? "flex" : "hidden lg:flex"
        )}
      >
        {!selectedChannel && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
            <MessageCircle className="w-12 h-12 text-surface-600 mb-3" />
            <p className="text-sm text-surface-400 font-medium">Select a conversation</p>
            <p className="text-xs text-surface-600 mt-1 max-w-xs">
              Pick a channel or start a direct message with someone on your team.
            </p>
          </div>
        )}

        {selectedChannel && showChatPane && (
          <>
            <header className="flex items-center gap-2 px-3 py-3 border-b border-surface-800 bg-surface-900/80 shrink-0">
              <button
                type="button"
                className="lg:hidden p-2 -ml-1 rounded-xl text-surface-300 hover:bg-surface-800"
                onClick={() => setMobileChatOpen(false)}
                aria-label="Back to conversations"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {selectedChannel.type === "DM" && selectedChannel.peer ? (
                <Avatar
                  firstName={selectedChannel.peer.firstName}
                  lastName={selectedChannel.peer.lastName}
                  avatarUrl={selectedChannel.peer.avatarUrl}
                  size="sm"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-surface-750 flex items-center justify-center">
                  <Hash className="w-4 h-4 text-surface-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-100 truncate">{channelTitle}</p>
                <p className="text-[11px] text-surface-500 truncate">
                  {selectedChannel.type === "DM"
                    ? "Direct message"
                    : selectedChannel.name}
                </p>
              </div>
            </header>

            <div ref={messagesRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
              {loadingMessages && (
                <p className="text-xs text-surface-500 text-center">Loading messages…</p>
              )}
              {!loadingMessages && messages.length === 0 && (
                <p className="text-xs text-surface-600 italic text-center py-6">
                  No messages yet. Say hello!
                </p>
              )}
              {messages.map((m) => {
                const mine = m.author.id === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}
                  >
                    {!mine && (
                      <Avatar
                        firstName={m.author.firstName}
                        lastName={m.author.lastName}
                        avatarUrl={m.author.avatarUrl}
                        size="xs"
                        className="flex-shrink-0 mt-0.5"
                      />
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm",
                        mine
                          ? "bg-primary-600 text-white rounded-br-md"
                          : "bg-surface-800 text-surface-100 border border-surface-700/80 rounded-bl-md"
                      )}
                    >
                      {!mine && selectedChannel.type !== "DM" && (
                        <p className="text-[10px] font-semibold text-primary-300/90 mb-1">
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
                                  "block rounded-lg overflow-hidden max-w-[min(100%,260px)] ring-1",
                                  mine ? "ring-white/25" : "ring-surface-600"
                                )}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={a.url}
                                  alt=""
                                  className="max-h-52 w-full object-cover"
                                />
                              </a>
                            ) : (
                              <video
                                key={i}
                                src={a.url}
                                controls
                                className="max-w-[min(100%,280px)] rounded-lg max-h-56"
                              />
                            )
                          )}
                        </div>
                      )}
                      {m.body?.trim() ? (
                        <p className="text-xs whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-surface-800 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-surface-900/90 shrink-0">
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
                    <div key={`${a.url}-${i}`} className="relative group">
                      {a.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt="" className="h-16 w-16 object-cover rounded-lg ring-1 ring-surface-600" />
                      ) : (
                        <video src={a.url} className="h-16 w-16 object-cover rounded-lg ring-1 ring-surface-600" muted />
                      )}
                      <button
                        type="button"
                        onClick={() => setStagedMedia((s) => s.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-surface-900 border border-surface-600 flex items-center justify-center text-surface-300 hover:text-white"
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
                    "rounded-2xl px-2.5 py-2.5 flex items-center justify-center flex-shrink-0",
                    uploadingMedia || stagedMedia.length >= 8
                      ? "text-surface-600 cursor-not-allowed"
                      : "text-surface-400 hover:text-primary-400 hover:bg-surface-800"
                  )}
                  title="Attach images or videos"
                >
                  <Paperclip className="w-5 h-5" />
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
                  placeholder={stagedMedia.length ? "Add a caption…" : "Message…"}
                  rows={1}
                  className="flex-1 bg-surface-800/80 border border-surface-700 rounded-2xl px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 resize-none max-h-32 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={(!input.trim() && stagedMedia.length === 0) || sending || uploadingMedia}
                  className={cn(
                    "rounded-2xl px-3 py-2.5 flex items-center justify-center flex-shrink-0",
                    (input.trim() || stagedMedia.length > 0) && !sending && !uploadingMedia
                      ? "bg-primary-600 text-white hover:bg-primary-500"
                      : "bg-surface-800 text-surface-500 cursor-not-allowed"
                  )}
                >
                  <Send className="w-4 h-4" />
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
        title="New message"
        description="Search for a team member to message directly."
        size="sm"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input
              type="search"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-surface-700/80">
            {dmCandidates.length === 0 && (
              <p className="text-xs text-surface-500 py-6 text-center">No people match your search.</p>
            )}
            {dmCandidates.map((u) => (
              <button
                key={u.id}
                type="button"
                disabled={startingDm}
                onClick={() => void startDirectMessage(u)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-800 text-left transition-colors"
              >
                <Avatar
                  firstName={u.firstName}
                  lastName={u.lastName}
                  avatarUrl={u.avatarUrl}
                  size="sm"
                />
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
    </div>
  );
}
