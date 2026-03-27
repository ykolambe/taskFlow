"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Channel {
  id: string;
  name: string;
  slug: string;
  type: "GLOBAL" | "ROLE" | "CUSTOM";
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
}

export default function TeamChatPage({ slug }: { slug: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/t/${slug}/chat/channels`);
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not load channels");
        return;
      }
      const list: Channel[] = j.data ?? [];
      setChannels(list);
      if (list.length > 0) setSelectedChannel(list[0]);
    };
    load();
  }, [slug]);

  useEffect(() => {
    if (!selectedChannel) return;
    let mounted = true;

    const loadMessages = async (showLoader: boolean) => {
      if (showLoader) setLoadingMessages(true);
      try {
        const res = await fetch(`/api/t/${slug}/chat/channels/${selectedChannel.id}/messages?take=50`, {
          cache: "no-store",
        });
        const j = await res.json();
        if (!res.ok) {
          if (showLoader) toast.error(j.error || "Could not load messages");
          return;
        }
        if (!mounted) return;
        const next: Message[] = j.data ?? [];
        setMessages((prev) => {
          if (prev.length === next.length && prev[prev.length - 1]?.id === next[next.length - 1]?.id) {
            return prev;
          }
          return next;
        });
      } finally {
        if (showLoader) setLoadingMessages(false);
      }
    };

    loadMessages(true);
    const timer = setInterval(() => {
      loadMessages(false);
    }, 3000);

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
    if (!text || !selectedChannel) return;
    setSending(true);
    try {
      const res = await fetch(`/api/t/${slug}/chat/channels/${selectedChannel.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not send message");
        return;
      }
      setMessages((prev) => [...prev, j.data]);
      setInput("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Channel list */}
      <aside className="w-56 border-r border-surface-800 bg-surface-900/80 flex-shrink-0">
        <div className="px-4 py-3 border-b border-surface-800 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary-400" />
          <p className="text-sm font-semibold text-surface-100">Team Chat</p>
        </div>
        <div className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {channels.map((c) => {
            const active = selectedChannel?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedChannel(c)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between",
                  active ? "bg-primary-500/20 text-primary-100" : "text-surface-300 hover:bg-surface-800"
                )}
              >
                <span className="truncate">#{c.slug}</span>
                <span className="text-[9px] uppercase text-surface-500">{c.type}</span>
              </button>
            );
          })}
          {channels.length === 0 && (
            <p className="text-[11px] text-surface-500 px-2 py-3">No channels yet.</p>
          )}
        </div>
      </aside>

      {/* Messages pane */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-surface-100">
              {selectedChannel ? `#${selectedChannel.slug}` : "Select a channel"}
            </p>
            {selectedChannel && (
              <p className="text-[11px] text-surface-500">
                Company-wide chat for {selectedChannel.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {loadingMessages && (
              <p className="text-xs text-surface-500">Loading messages…</p>
            )}
            {!loadingMessages && messages.length === 0 && (
              <p className="text-xs text-surface-600 italic">
                No messages yet. Start the conversation for your team.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="flex gap-2.5">
                <Avatar
                  firstName={m.author.firstName}
                  lastName={m.author.lastName}
                  avatarUrl={m.author.avatarUrl}
                  size="xs"
                  className="flex-shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-surface-200">
                    {m.author.firstName} {m.author.lastName}
                  </p>
                  <p className="text-xs text-surface-300 whitespace-pre-wrap break-words">
                    {m.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-surface-800 px-4 py-3">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) send();
                  }
                }}
                placeholder="Send a message to your team… (Enter to send, Shift+Enter new line)"
                rows={1}
                className="flex-1 bg-surface-900/80 border border-surface-700 rounded-xl px-3 py-2 text-xs text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 resize-none"
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || sending || !selectedChannel}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1",
                  input.trim() && !sending && selectedChannel
                    ? "bg-primary-600 text-white hover:bg-primary-500"
                    : "bg-surface-800 text-surface-500 cursor-default"
                )}
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

