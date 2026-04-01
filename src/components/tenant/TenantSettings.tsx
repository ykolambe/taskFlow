"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Settings, Plus, Trash2, Save, Key, Copy, User, ListChecks, GripVertical, Upload, MessageCircle, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { TenantTokenPayload } from "@/lib/auth";
import { RoleLevel } from "@/types";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { copyToClipboard } from "@/lib/utils";
import TenantScheduledPushPanel from "@/components/tenant/TenantScheduledPushPanel";

interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  modules: string[];
  roleLevels: RoleLevel[];
  hierarchyTiers?: { level: number; defaultAiAddon: boolean }[];
}

interface StatusConfig {
  id: string;
  key: string;
  label: string;
  color: string;
  order: number;
  type: "OPEN" | "ACTIVE" | "REVIEW" | "DONE";
}

interface Props {
  company: Company;
  user: TenantTokenPayload;
  slug: string;
  taskStatuses: StatusConfig[];
}

const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];

const TYPE_LABELS: Record<string, string> = {
  OPEN: "Start",
  ACTIVE: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
};
const TYPE_COLORS: Record<string, string> = {
  OPEN: "bg-surface-700 text-surface-400",
  ACTIVE: "bg-blue-500/15 text-blue-300",
  REVIEW: "bg-amber-500/15 text-amber-300",
  DONE: "bg-emerald-500/15 text-emerald-300",
};

export default function TenantSettings({ company, user, slug, taskStatuses: initialStatuses }: Props) {
  const router = useRouter();
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [orgName, setOrgName] = useState(company.name);
  const [logoUrl, setLogoUrl] = useState(company.logoUrl ?? "");
  const [savingBranding, setSavingBranding] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [roleLevels, setRoleLevels] = useState(company.roleLevels);
  const [tierAiByLevel, setTierAiByLevel] = useState<Record<number, boolean>>(() => {
    const o: Record<number, boolean> = {};
    for (const t of company.hierarchyTiers ?? []) o[t.level] = t.defaultAiAddon;
    return o;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const o: Record<number, boolean> = {};
    for (const t of company.hierarchyTiers ?? []) o[t.level] = t.defaultAiAddon;
    setTierAiByLevel(o);
  }, [company.hierarchyTiers]);

  const distinctHierarchyLevels = useMemo(
    () =>
      [...new Set(roleLevels.map((l) => Math.min(999, Math.max(1, Number(l.level) || 1))))].sort((a, b) => a - b),
    [roleLevels]
  );
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Status management state
  const [statuses, setStatuses] = useState<StatusConfig[]>(initialStatuses);
  const [savingStatuses, setSavingStatuses] = useState(false);
  const [newStatus, setNewStatus] = useState({ label: "", color: "#64748b", type: "ACTIVE" as StatusConfig["type"] });
  const [addingStatus, setAddingStatus] = useState(false);
  const [showAddStatus, setShowAddStatus] = useState(false);

  // Channel management
  const [channels, setChannels] = useState<{ id: string; slug: string; name: string; type: "GLOBAL" | "ROLE" | "CUSTOM"; roleLevelId: string | null }[] | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelForm, setChannelForm] = useState<{ slug: string; name: string; type: "GLOBAL" | "ROLE" | "CUSTOM"; roleLevelId: string }>({
    slug: "",
    name: "",
    type: "GLOBAL",
    roleLevelId: "",
  });
  const [creatingChannel, setCreatingChannel] = useState(false);

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const res = await fetch(`/api/t/${slug}/chat/channels?excludeDm=true`);
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not load channels");
        return;
      }
      setChannels(j.data ?? []);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!channelForm.slug.trim() || !channelForm.name.trim()) {
      toast.error("Slug and name are required");
      return;
    }
    if (channelForm.type === "ROLE" && !channelForm.roleLevelId) {
      toast.error("Select a role for ROLE channels");
      return;
    }
    setCreatingChannel(true);
    try {
      const res = await fetch(`/api/t/${slug}/chat/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: channelForm.slug,
          name: channelForm.name,
          type: channelForm.type,
          roleLevelId: channelForm.type === "ROLE" ? channelForm.roleLevelId : null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not create channel");
        return;
      }
      toast.success("Channel created");
      setChannelForm({ slug: "", name: "", type: "GLOBAL", roleLevelId: "" });
      await loadChannels();
    } finally {
      setCreatingChannel(false);
    }
  };

  const addLevel = () => {
    const maxLv = roleLevels.reduce((m, l) => Math.max(m, Number(l.level) || 1), 0);
    const next = maxLv + 1;
    setRoleLevels([
      ...roleLevels,
      {
        id: "",
        name: `Role ${roleLevels.length + 1}`,
        level: next,
        color: COLORS[next % COLORS.length],
        companyId: company.id,
        canApprove: true,
      },
    ]);
  };

  const removeLevel = (index: number) => {
    if (roleLevels.length <= 1) return;
    setRoleLevels(roleLevels.filter((_, i) => i !== index));
  };

  const updateLevel = (index: number, field: string, value: string | boolean | number) => {
    setRoleLevels(roleLevels.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const handleSaveRoles = async () => {
    setSaving(true);
    try {
      const hierarchyTiers = distinctHierarchyLevels.map((lv) => ({
        level: lv,
        defaultAiAddon: tierAiByLevel[lv] ?? false,
      }));
      const res = await fetch(`/api/t/${slug}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleLevels, hierarchyTiers }),
      });
      if (res.ok) {
        toast.success("Role levels updated!");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  };


  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const res = await fetch(`/api/t/${slug}/company`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim(), logoUrl: logoUrl.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }
      toast.success("Organization updated");
      router.refresh();
    } finally {
      setSavingBranding(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `/api/upload?type=logo&slug=${encodeURIComponent(slug)}`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Upload failed");
        return;
      }

      const patchRes = await fetch(`/api/t/${slug}/company`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: data.url }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        toast.error(patchData.error || "Failed to save logo");
        return;
      }

      setLogoUrl(data.url);
      toast.success("Logo uploaded");
      router.refresh();
    } finally {
      setLogoUploading(false);
      if (logoFileRef.current) logoFileRef.current.value = "";
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.newPass || passwordForm.newPass !== passwordForm.confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (passwordForm.newPass.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`/api/t/${slug}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.newPass }),
      });
      if (res.ok) {
        toast.success("Password changed!");
        setPasswordForm({ current: "", newPass: "", confirm: "" });
        setShowPasswordForm(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUpdateStatusLabel = (id: string, label: string) => {
    setStatuses((s) => s.map((x) => (x.id === id ? { ...x, label } : x)));
  };

  const handleUpdateStatusColor = (id: string, color: string) => {
    setStatuses((s) => s.map((x) => (x.id === id ? { ...x, color } : x)));
  };

  const handleSaveStatuses = async () => {
    setSavingStatuses(true);
    try {
      const res = await fetch(`/api/t/${slug}/statuses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statuses }),
      });
      if (res.ok) {
        toast.success("Statuses saved!");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed");
      }
    } finally {
      setSavingStatuses(false);
    }
  };

  const handleAddStatus = async () => {
    if (!newStatus.label.trim()) { toast.error("Label is required"); return; }
    setAddingStatus(true);
    try {
      const res = await fetch(`/api/t/${slug}/statuses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStatus),
      });
      const data = await res.json();
      if (res.ok) {
        setStatuses((s) => [...s, data.data]);
        setNewStatus({ label: "", color: "#64748b", type: "ACTIVE" });
        setShowAddStatus(false);
        toast.success("Status added!");
      } else {
        toast.error(data.error || "Failed");
      }
    } finally {
      setAddingStatus(false);
    }
  };

  const handleDeleteStatus = async (id: string, label: string) => {
    if (!confirm(`Delete "${label}"? Tasks with this status will move back to the starting status.`)) return;
    const res = await fetch(`/api/t/${slug}/statuses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatuses((s) => s.filter((x) => x.id !== id));
      toast.success("Status deleted");
    } else {
      const data = await res.json();
      toast.error(data.error || "Cannot delete");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-surface-100">Settings</h1>
        <p className="text-surface-400 text-xs mt-0.5">Manage your workspace configuration</p>
      </div>

      {user.isSuperAdmin && (
        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
          <h2 className="font-semibold text-surface-100 mb-1">Organization branding</h2>
          <p className="text-xs text-surface-500 mb-4">
            Logo and name appear in the top-left sidebar and on the org chart. Paste a public HTTPS image URL, or upload a file (JPEG, PNG, GIF, or WebP, up to 5 MB).
          </p>
          <div className="space-y-3 max-w-lg">
            <Input label="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <Input
              label="Logo URL"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
            <div>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleLogoFileChange}
              />
              <button
                type="button"
                onClick={() => logoFileRef.current?.click()}
                disabled={logoUploading}
                className="inline-flex items-center gap-2 text-xs font-medium text-primary-400 hover:text-primary-300 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {logoUploading ? "Uploading…" : "Upload logo"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="w-14 h-14 rounded-xl object-cover border border-surface-600 bg-surface-900" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-surface-750 border border-dashed border-surface-600 flex items-center justify-center text-[10px] text-surface-600 px-2 text-center">
                  No logo
                </div>
              )}
              <Button size="sm" loading={savingBranding} onClick={handleSaveBranding}>
                Save organization
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Profile */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary-400" />
          <h2 className="font-semibold text-surface-100">My Profile</h2>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center font-bold text-white text-xl">
            {user.firstName.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-surface-100">{user.firstName} {user.lastName}</p>
            <p className="text-sm text-surface-400">{user.email}</p>
            {user.isSuperAdmin && (
              <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full">Super Admin</span>
            )}
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setShowPasswordForm(!showPasswordForm)}>
          <Key className="w-3.5 h-3.5" /> Change Password
        </Button>
        {showPasswordForm && (
          <div className="mt-4 space-y-3 border-t border-surface-700 pt-4">
            <Input label="Current Password" type="password" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} />
            <Input label="New Password" type="password" value={passwordForm.newPass} onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })} />
            <Input label="Confirm New Password" type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowPasswordForm(false)}>Cancel</Button>
              <Button size="sm" loading={changingPassword} onClick={handleChangePassword}>Update Password</Button>
            </div>
          </div>
        )}
      </div>

      {/* Task Statuses */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary-400" />
            <h2 className="font-semibold text-surface-100">Task Statuses</h2>
          </div>
          <button
            onClick={() => setShowAddStatus(!showAddStatus)}
            className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Status
          </button>
        </div>
        <p className="text-xs text-surface-500 mb-4">
          Define the workflow stages for tasks. <span className="text-amber-400">Start</span> and <span className="text-emerald-400">Done</span> are required — you can rename them but not delete them.
        </p>

        <div className="space-y-2 mb-4">
          {statuses.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-3 bg-surface-750 rounded-xl border border-surface-700"
            >
              <GripVertical className="w-4 h-4 text-surface-600 flex-shrink-0" />
              <input
                type="color"
                value={s.color}
                onChange={(e) => handleUpdateStatusColor(s.id, e.target.value)}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0 flex-shrink-0"
                title="Status color"
              />
              <input
                value={s.label}
                onChange={(e) => handleUpdateStatusLabel(s.id, e.target.value)}
                className="flex-1 bg-transparent text-sm text-surface-100 focus:outline-none min-w-0"
                placeholder="Status label"
              />
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLORS[s.type]}`}>
                {TYPE_LABELS[s.type]}
              </span>
              {s.type !== "OPEN" && s.type !== "DONE" ? (
                <button
                  onClick={() => handleDeleteStatus(s.id, s.label)}
                  className="text-surface-600 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Delete status"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="w-5 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {showAddStatus && (
          <div className="border border-primary-500/30 rounded-xl p-4 bg-primary-500/5 space-y-3 mb-4">
            <p className="text-xs font-semibold text-surface-300">New Status</p>
            <Input
              label="Label"
              value={newStatus.label}
              onChange={(e) => setNewStatus({ ...newStatus, label: e.target.value })}
              placeholder="e.g. QA Testing, Blocked, In Review…"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-surface-400">Type</label>
                <select
                  value={newStatus.type}
                  onChange={(e) => setNewStatus({ ...newStatus, type: e.target.value as StatusConfig["type"] })}
                  className="bg-surface-900/80 border border-surface-700/80 rounded-xl px-4 py-2.5 text-sm text-surface-100 focus:outline-none focus:border-primary-500/70"
                >
                  <option value="ACTIVE">In Progress (intermediate)</option>
                  <option value="REVIEW">Review (needs approval)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-surface-400">Color</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewStatus({ ...newStatus, color: c })}
                      className={`w-6 h-6 rounded-full transition-all ${newStatus.color === c ? "ring-2 ring-white ring-offset-1 ring-offset-surface-800 scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowAddStatus(false)}>Cancel</Button>
              <Button size="sm" loading={addingStatus} onClick={handleAddStatus}>Add Status</Button>
            </div>
          </div>
        )}

        <Button onClick={handleSaveStatuses} loading={savingStatuses} size="sm">
          <Save className="w-3.5 h-3.5" /> Save Status Names & Colors
        </Button>
      </div>

      {/* Team Chat Channels (super admin) */}
      {user.isSuperAdmin && (
        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary-400" />
              <h2 className="font-semibold text-surface-100">Team Chat Channels</h2>
            </div>
            <button
              type="button"
              onClick={channels === null ? loadChannels : undefined}
              className="text-xs text-primary-400 hover:text-primary-300"
            >
              {channels === null ? "Load channels" : ""}
            </button>
          </div>
          <p className="text-xs text-surface-500 mb-4">
            Configure company-wide chat channels. Use <span className="font-semibold text-surface-200">GLOBAL</span> or{" "}
            <span className="font-semibold text-surface-200">CUSTOM</span> for channels that everyone can access. Use{" "}
            <span className="font-semibold text-surface-200">ROLE</span> only for narrower leadership or supervisor groups.
          </p>

          {/* Existing channels */}
          <div className="space-y-1 mb-4 max-h-40 overflow-y-auto pr-1">
            {loadingChannels && <p className="text-xs text-surface-500">Loading channels…</p>}
            {channels && channels.length === 0 && !loadingChannels && (
              <p className="text-xs text-surface-600 italic">No channels yet. Create your first one below.</p>
            )}
            {channels &&
              channels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-750 text-xs text-surface-200"
                >
                  <span className="truncate">#{ch.slug}</span>
                  <span className="text-[10px] uppercase text-surface-500">{ch.type}</span>
                </div>
              ))}
          </div>

          {/* Create channel form */}
          <div className="border-t border-surface-700 pt-3 space-y-2">
            <p className="text-xs font-semibold text-surface-300">Create new channel</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                label="Slug"
                placeholder="general"
                value={channelForm.slug}
                onChange={(e) => setChannelForm((f) => ({ ...f, slug: e.target.value }))}
              />
              <Input
                label="Name"
                placeholder="General chat"
                value={channelForm.name}
                onChange={(e) => setChannelForm((f) => ({ ...f, name: e.target.value }))}
              />
              <div>
                <label className="block text-[11px] text-surface-500 mb-1">Type</label>
                <select
                  value={channelForm.type}
                  onChange={(e) =>
                    setChannelForm((f) => ({
                      ...f,
                      type: e.target.value as "GLOBAL" | "ROLE" | "CUSTOM",
                      roleLevelId: e.target.value === "ROLE" ? f.roleLevelId : "",
                    }))
                  }
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-200 focus:outline-none focus:border-primary-500"
                >
                  <option value="GLOBAL">GLOBAL (everyone)</option>
                  <option value="CUSTOM">CUSTOM (everyone)</option>
                  <option value="ROLE">ROLE (by level)</option>
                </select>
              </div>
            </div>

            {channelForm.type === "ROLE" && (
              <div className="mt-1">
                <label className="block text-[11px] text-surface-500 mb-1">Role level for this channel</label>
                <select
                  value={channelForm.roleLevelId}
                  onChange={(e) => setChannelForm((f) => ({ ...f, roleLevelId: e.target.value }))}
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-200 focus:outline-none focus:border-primary-500"
                >
                  <option value="">Select role…</option>
                  {roleLevels.map((rl) => (
                    <option key={rl.id} value={rl.id}>
                      {rl.name} (L{rl.level})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-1">
              <Button size="sm" loading={creatingChannel} onClick={handleCreateChannel}>
                <Plus className="w-3.5 h-3.5" /> Create Channel
              </Button>
            </div>
          </div>
        </div>
      )}

      {user.isSuperAdmin && <TenantScheduledPushPanel slug={slug} />}

      {/* Role Levels */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary-400" />
            <h2 className="font-semibold text-surface-100">Hierarchy Levels</h2>
          </div>
          <button onClick={addLevel} className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Level
          </button>
        </div>
        <p className="text-xs text-surface-500 mb-3">
          Lower numbers are higher in the org (e.g. 1 = top). Multiple roles can share the same number — e.g. CEO and CTO both at level 2,
          with managers at level 3.
        </p>

        <div className="space-y-2 mb-4">
          {roleLevels.map((level, index) => (
            <div key={index} className="flex items-center gap-2 sm:gap-3 p-3 bg-surface-750 rounded-xl border border-surface-700 flex-wrap">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: level.color }} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-surface-500 uppercase tracking-wide">Tier</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={level.level}
                  onChange={(e) =>
                    updateLevel(index, "level", Math.min(999, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                  className="w-14 shrink-0 bg-surface-900/80 border border-surface-700 rounded-lg px-1.5 py-1 text-xs text-surface-100 text-center"
                />
              </div>
              <input
                value={level.name}
                onChange={(e) => updateLevel(index, "name", e.target.value)}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-surface-100 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-surface-500 flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={level.canApprove}
                    onChange={(e) => updateLevel(index, "canApprove", e.target.checked)}
                    className="rounded"
                  />
                  Can approve
                </label>
              </div>
              <input type="color" value={level.color} onChange={(e) => updateLevel(index, "color", e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
              {roleLevels.length > 1 && (
                <button onClick={() => removeLevel(index)} className="text-surface-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {distinctHierarchyLevels.length > 0 && (
          <div className="mb-4 rounded-xl border border-primary-500/20 bg-primary-500/5 px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary-400" />
              <p className="text-xs font-semibold text-surface-200">AI add-on by hierarchy tier</p>
            </div>
            <p className="text-[11px] text-surface-500 leading-relaxed">
              When your plan includes the AI add-on, enabling a tier here gives every active member at that tier access by default.
              It counts toward AI usage. Individual users can still be toggled on the Team page.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {distinctHierarchyLevels.map((lv) => (
                <label key={lv} className="inline-flex items-center gap-2 text-xs text-surface-200 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-surface-600"
                    checked={tierAiByLevel[lv] ?? false}
                    onChange={() => setTierAiByLevel((p) => ({ ...p, [lv]: !p[lv] }))}
                  />
                  Tier {lv}
                </label>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleSaveRoles} loading={saving} size="sm">
          <Save className="w-3.5 h-3.5" /> Save Hierarchy
        </Button>
      </div>

      {/* Company Info */}
      <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
        <h2 className="font-semibold text-surface-100 mb-3">Workspace Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-surface-700">
            <span className="text-surface-400">Company Name</span>
            <span className="text-surface-200 font-medium">{company.name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-surface-700">
            <span className="text-surface-400">URL Slug</span>
            <div className="flex items-center gap-2">
              <code className="text-primary-400 text-xs">{company.slug}</code>
              <button
                type="button"
                onClick={async () => {
                  const url =
                    typeof window !== "undefined"
                      ? `${window.location.origin}/t/${company.slug}`
                      : `http://localhost:3000/t/${company.slug}`;
                  const ok = await copyToClipboard(url);
                  if (ok) toast.success("URL copied!");
                  else toast.error("Could not copy — select the text manually");
                }}
                className="text-surface-500 hover:text-surface-300"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-surface-400">Modules</span>
            <div className="flex gap-1 flex-wrap justify-end">
              {company.modules.map((m) => (
                <span key={m} className="text-xs bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded-full capitalize">{m}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
