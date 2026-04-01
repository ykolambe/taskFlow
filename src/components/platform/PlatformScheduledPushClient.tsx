"use client";

import { useEffect, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import toast from "react-hot-toast";

type Company = { id: string; name: string; slug: string };

type Row = {
  id: string;
  companyId: string | null;
  title: string;
  body: string;
  targetPath: string;
  scheduledAt: string;
  status: string;
  sentAt: string | null;
  recipientCount: number | null;
};

export default function PlatformScheduledPushClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetPath, setTargetPath] = useState("/platform/dashboard");
  const [companyId, setCompanyId] = useState<string>("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const [cRes, sRes] = await Promise.all([
      fetch("/api/platform/companies"),
      fetch("/api/platform/push/scheduled"),
    ]);
    const cData = await cRes.json();
    const sData = await sRes.json();
    if (cRes.ok) setCompanies(cData.data ?? []);
    if (sRes.ok) setRows(sData.data ?? []);
  };

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const schedule = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    if (!scheduledLocal) {
      toast.error("Pick a date and time");
      return;
    }
    const d = new Date(scheduledLocal);
    if (Number.isNaN(d.getTime())) {
      toast.error("Invalid schedule time");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/platform/push/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          targetPath: targetPath.trim() || "/platform/dashboard",
          scheduledAt: d.toISOString(),
          companyId: companyId || null,
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
      setScheduledLocal("");
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this scheduled notification?")) return;
    const res = await fetch(`/api/platform/push/scheduled/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed");
      return;
    }
    toast.success("Cancelled");
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-700 bg-surface-850/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary-400" />
          <h2 className="font-semibold text-surface-100">New broadcast</h2>
        </div>
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline" />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-surface-300">Message</label>
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-surface-300">Audience</label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="bg-surface-900 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-100"
          >
            <option value="">All companies (every opted-in user)</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.slug})
              </option>
            ))}
          </select>
        </div>
        <Input label="Open path" value={targetPath} onChange={(e) => setTargetPath(e.target.value)} placeholder="/t/slug/dashboard" />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-surface-300">Send at (local)</label>
          <input
            type="datetime-local"
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
            className="bg-surface-900 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-100"
          />
        </div>
        <Button size="sm" loading={saving || loading} onClick={schedule}>
          Schedule
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-surface-300 mb-2">Recent jobs</h3>
        {loading && <p className="text-xs text-surface-500">Loading…</p>}
        {!loading && rows.length === 0 && <p className="text-xs text-surface-600">None yet.</p>}
        {!loading && rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-surface-700 bg-surface-800/80 px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-medium text-surface-200">{r.title}</p>
                  <p className="text-surface-500">
                    {new Date(r.scheduledAt).toLocaleString()} · {r.status}
                    {r.companyId ? " · one company" : " · all companies"}
                    {r.recipientCount != null && r.status === "SENT" ? ` · ${r.recipientCount} devices` : ""}
                  </p>
                </div>
                {r.status === "PENDING" && (
                  <button type="button" onClick={() => cancel(r.id)} className="text-surface-500 hover:text-red-400 p-1" title="Cancel">
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
