"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Upload } from "lucide-react";
import toast from "react-hot-toast";
import type { Priority, UserBrief } from "@/types";
import { cn } from "@/lib/utils";
import { AttachmentPreviewRow } from "@/components/tenant/AttachmentPreview";

interface Props {
  open: boolean;
  onClose: () => void;
  slug: string;
  onCreated?: () => void;
}

export default function TaskRequestModal({ open, onClose, slug, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [approverId, setApproverId] = useState("");
  const [eligible, setEligible] = useState<UserBrief[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingList(true);
    fetch(`/api/t/${slug}/task-requests/eligible-approvers`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setEligible(d.data);
          if (d.data?.length === 1) setApproverId(d.data[0].id);
        } else toast.error(d.error || "Could not load approvers");
      })
      .catch(() => toast.error("Could not load approvers"))
      .finally(() => setLoadingList(false));
  }, [open, slug]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setDueDate("");
      setApproverId("");
      setPendingFile(null);
    }
  }, [open]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch(`/api/upload?type=attachment&slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        body: fd,
      });
      const upData = await upRes.json();
      if (!upRes.ok) {
        toast.error(upData.error || "Upload failed");
        return;
      }
      setPendingFile({
        url: upData.url,
        fileName: upData.fileName,
        fileSize: upData.fileSize,
        mimeType: upData.mimeType,
      });
      toast.success("File attached");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!approverId) {
      toast.error("Select an approver");
      return;
    }
    if (eligible.length === 0) {
      toast.error("No approvers available in your reporting line");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/t/${slug}/task-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          approverId,
          priority,
          dueDate: dueDate || undefined,
          attachment: pendingFile || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to submit");
        return;
      }
      toast.success("Request submitted for approval");
      onCreated?.();
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Request task approval" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-surface-500">
          Your manager will review this. When they approve, a task is created with the same details.
        </p>
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you need done?"
          required
        />
        <Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Context, acceptance criteria…"
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
          <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-400 mb-1.5">Approver</label>
          {loadingList ? (
            <p className="text-xs text-surface-500">Loading…</p>
          ) : eligible.length === 0 ? (
            <p className="text-xs text-amber-400/90">
              No one is above you in the reporting line. Ask an admin to set your manager (parent) in the org chart.
            </p>
          ) : (
            <select
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
              required
            >
              <option value="">Select approver…</option>
              {eligible.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.roleLevel?.name ?? "Role"}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-surface-400">Attachment (optional)</p>
          {pendingFile ? (
            <AttachmentPreviewRow
              fileUrl={pendingFile.url}
              fileName={pendingFile.fileName}
              fileSize={pendingFile.fileSize}
              mimeType={pendingFile.mimeType}
              showRemove
              onRemove={() => setPendingFile(null)}
            />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={cn(
                "w-full border border-dashed border-surface-600 rounded-lg py-3 text-xs text-surface-400 hover:border-surface-500 flex items-center justify-center gap-2",
                uploading && "opacity-50"
              )}
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading…" : "Upload photo or file"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
            }}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={submitting} disabled={eligible.length === 0}>
            Submit request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
