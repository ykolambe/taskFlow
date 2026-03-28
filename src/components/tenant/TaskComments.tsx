"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Trash2, Pencil, X, Check, AtSign } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { TaskComment } from "@/types";
import { TenantTokenPayload } from "@/lib/auth";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

interface Props {
  taskId: string;
  slug: string;
  user: TenantTokenPayload;
}

export default function TaskComments({ taskId, slug, user }: Props) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const apiBase = `/api/t/${slug}/tasks/${taskId}/comments`;

  // ── Load comments ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(apiBase)
      .then((r) => r.json())
      .then((d) => { if (d.success) setComments(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiBase]);

  // Scroll to bottom whenever comments change
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments.length]);

  // ── Submit comment ─────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setSubmitting(true);

    // Optimistic placeholder
    const tempId = `temp-${Date.now()}`;
    const optimistic: TaskComment = {
      id: tempId,
      taskId,
      authorId: user.userId,
      body: trimmed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: null,
        roleLevelId: "",
        roleLevel: { id: "", companyId: "", name: "", level: user.level, color: "#6366f1", canApprove: false },
        email: user.email,
        username: "",
        isSuperAdmin: user.isSuperAdmin,
      },
    };
    setComments((prev) => [...prev, optimistic]);
    setBody("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to post comment");
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setBody(trimmed);
        return;
      }
      setComments((prev) => prev.map((c) => (c.id === tempId ? data.data : c)));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete comment ─────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete comment");
      // Re-fetch to restore state
      fetch(apiBase)
        .then((r) => r.json())
        .then((d) => { if (d.success) setComments(d.data); });
    }
  };

  // ── Edit comment ───────────────────────────────────────────────────────────

  const startEdit = (comment: TaskComment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody("");
  };

  const handleEdit = async (id: string) => {
    const trimmed = editBody.trim();
    if (!trimmed) return;

    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, body: trimmed } : c))
    );
    setEditingId(null);

    const res = await fetch(`${apiBase}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: trimmed }),
    });
    if (!res.ok) {
      toast.error("Could not update comment");
      fetch(apiBase)
        .then((r) => r.json())
        .then((d) => { if (d.success) setComments(d.data); });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-surface-500 text-xs py-2">
        <MessageCircle className="w-3.5 h-3.5" />
        Loading comments…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <p className="text-xs font-semibold text-surface-400 flex items-center gap-1.5">
        <MessageCircle className="w-3.5 h-3.5" />
        Comments{" "}
        {comments.length > 0 && (
          <span className="text-surface-500">({comments.length})</span>
        )}
      </p>

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-xs text-surface-600 italic py-1">No comments yet. Leave the first update for your team.</p>
      ) : (
        <div ref={listRef} className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {comments.map((comment) => {
            const isOwn = comment.authorId === user.userId;
            const isEditing = editingId === comment.id;

            return (
              <div key={comment.id} className="flex gap-2.5 group">
                {comment.isSystem ? (
                  <div
                    className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-sky-300"
                    title="Automated message"
                  >
                    S
                  </div>
                ) : (
                  <Avatar
                    firstName={comment.author.firstName}
                    lastName={comment.author.lastName}
                    avatarUrl={comment.author.avatarUrl}
                    size="xs"
                    className="flex-shrink-0 mt-0.5"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {comment.isSystem ? (
                      <span className="text-xs font-semibold text-sky-300">System</span>
                    ) : (
                      <span className="text-xs font-semibold text-surface-200">
                        {comment.author.firstName} {comment.author.lastName}
                      </span>
                    )}
                    <span className="text-[10px] text-surface-600">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                    {comment.updatedAt !== comment.createdAt && (
                      <span className="text-[9px] text-surface-600 italic">(edited)</span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleEdit(comment.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        rows={2}
                        maxLength={2000}
                        className="w-full bg-surface-900/80 border border-primary-500/40 rounded-lg px-3 py-2 text-xs text-surface-100 caret-surface-100 placeholder:text-surface-500 resize-none focus:outline-none focus:border-primary-500 transition-all"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleEdit(comment.id)}
                          disabled={!editBody.trim()}
                          className="text-[10px] flex items-center gap-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-[10px] flex items-center gap-1 text-surface-500 hover:text-surface-300 transition-colors"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                        <span className="text-[9px] text-surface-600 ml-auto">⌘↵ to save · Esc to cancel</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-surface-300 leading-relaxed whitespace-pre-wrap break-words">
                      {comment.body}
                    </p>
                  )}
                </div>

                {/* Actions (own comments only) */}
                {isOwn && !isEditing && !comment.isSystem && (
                  <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => startEdit(comment)}
                      className="text-surface-500 hover:text-primary-400 transition-colors p-0.5"
                      title="Edit"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-surface-500 hover:text-red-400 transition-colors p-0.5"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Compose */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <Avatar
          firstName={user.firstName}
          lastName={user.lastName}
          size="xs"
          className="flex-shrink-0 mb-0.5"
        />
        <div className="flex-1 relative">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (body.trim()) handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Add a comment… (mention with @name, ⌘↵ to send)"
            rows={1}
            maxLength={2000}
            className={cn(
              "w-full bg-surface-900/80 border border-surface-600 rounded-xl px-3 py-2 pr-9 text-xs text-surface-100 caret-surface-100",
              "placeholder:text-surface-500 resize-none focus:outline-none focus:border-primary-500",
              "transition-all duration-200"
            )}
            style={{ minHeight: "36px" }}
          />
          <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
            <span className="hidden sm:inline text-[9px] text-surface-500 mr-1">
              ⌘↵ to send
            </span>
            <button
              type="submit"
              disabled={!body.trim() || submitting}
              className={cn(
                "transition-all rounded-full p-1",
                body.trim() && !submitting
                  ? "text-primary-400 hover:text-primary-300 bg-primary-500/10"
                  : "text-surface-600 cursor-default"
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
