"use client";

import { useEffect, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import toast from "react-hot-toast";

type Row = {
  id: string;
  title: string;
  body: string;
  targetPath: string;
  scheduledAt: string;
  status: string;
  sentAt: string | null;
  recipientCount: number | null;
  errorMessage: string | null;
};

export default function TenantScheduledPushPanel({ slug }: { slug: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/t/${slug}/push/scheduled`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load");
        return;
      }
      setRows(data.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [slug]);

  const schedule = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    let iso: string;
    if (scheduledLocal) {
      const d = new Date(scheduledLocal);
      if (Number.isNaN(d.getTime())) {
        toast.error("Invalid schedule time");
        return;
      }
      iso = d.toISOString();
    } else {
      toast.error("Pick a date and time");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/t/${slug}/push/scheduled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          targetPath: targetPath.trim() || undefined,
          scheduledAt: iso,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed");
        return;
      }
      toast.success("Scheduled");
      setTitle("");
      setBody("");
      setTargetPath("");
      setScheduledLocal("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this scheduled notification?")) return;
    const res = await fetch(`/api/t/${slug}/push/scheduled/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed");
      return;
    }
    toast.success("Cancelled");
    await load();
  };

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-primary-400" />
        <h2 className="font-semibold text-surface-100">Scheduled push announcements</h2>
      </div>
      <p className="text-xs text-surface-500 mb-4">
        Sends a Web Push to everyone in your workspace who enabled notifications. Requires server VAPID configuration.
      </p>

      <div className="space-y-3 mb-4 max-w-lg">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Town hall Tuesday" />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-surface-300">Message</label>
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Short body text" />
        </div>
        <Input
          label="Open path (optional)"
          value={targetPath}
          onChange={(e) => setTargetPath(e.target.value)}
          placeholder={`/t/${slug}/dashboard`}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-surface-300">Send at (local)</label>
          <input
            type="datetime-local"
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
            className="bg-surface-900 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-100"
          />
        </div>
        <Button size="sm" loading={saving} onClick={schedule}>
          Schedule broadcast
        </Button>
      </div>

      <div className="border-t border-surface-700 pt-4">
        <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Upcoming & recent</p>
        {loading && rows === null && <p className="text-xs text-surface-500">Loading…</p>}
        {rows && rows.length === 0 && <p className="text-xs text-surface-600">No scheduled pushes yet.</p>}
        {rows && rows.length > 0 && (
          <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-2 rounded-lg bg-surface-750 border border-surface-700 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-surface-200 truncate">{r.title}</p>
                  <p className="text-surface-500">
                    {new Date(r.scheduledAt).toLocaleString()} · {r.status}
                    {r.recipientCount != null && r.status === "SENT" ? ` · ${r.recipientCount} devices` : ""}
                  </p>
                </div>
                {r.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => cancel(r.id)}
                    className="text-surface-500 hover:text-red-400 p-1"
                    title="Cancel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
