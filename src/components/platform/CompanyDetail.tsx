"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Users, CheckSquare, Copy, RefreshCw, Plus,
  Trash2, Save, CreditCard, Settings, Zap, Star, Crown,
  Sparkles, BarChart3, FileText, Lightbulb, AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface CompanyBilling {
  id?: string;
  plan: string;
  pricePerSeat: number | null;
  aiAddonEnabled: boolean;
  aiPricePerSeat: number | null;
  seatsLimit: number | null;
  billingEmail: string | null;
  notes: string | null;
  trialEndsAt: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  modules: string[];
  billing: CompanyBilling | null;
  _count: { users: number; tasks: number; ideas?: number; recurringTasks?: number };
  roleLevels: { id: string; name: string; level: number; color: string; canApprove: boolean }[];
  users: { id: string; email: string; firstName: string; lastName: string }[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const PLANS = [
  { key: "FREE",       label: "Free",       icon: Zap,      color: "#64748b" },
  { key: "STARTER",    label: "Starter",    icon: Star,     color: "#3b82f6" },
  { key: "PRO",        label: "Pro",        icon: Crown,    color: "#8b5cf6" },
  { key: "ENTERPRISE", label: "Enterprise", icon: Sparkles, color: "#f59e0b" },
] as const;

const STATUS_OPTIONS = [
  { key: "active",   label: "Active"   },
  { key: "trialing", label: "Trialing" },
  { key: "past_due", label: "Past Due" },
  { key: "canceled", label: "Canceled" },
];

const STATUS_CLASSES: Record<string, string> = {
  active:   "bg-emerald-500/15 text-emerald-300",
  trialing: "bg-blue-500/15    text-blue-300",
  past_due: "bg-red-500/15     text-red-300",
  canceled: "bg-surface-700    text-surface-400",
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function CompanyDetail({ company }: { company: Company }) {
  const router = useRouter();
  const [tab, setTab] = useState<"settings" | "billing">("settings");

  // ── Settings state ──
  const [name, setName] = useState(company.name);
  const [isActive, setIsActive] = useState(company.isActive);
  const [modules, setModules] = useState(company.modules);
  const [roleLevels, setRoleLevels] = useState(company.roleLevels);
  const [saving, setSaving] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null);

  // ── Billing state ──
  const b = company.billing;
  const [billingForm, setBillingForm] = useState({
    plan: b?.plan ?? "FREE",
    pricePerSeat: b?.pricePerSeat !== null && b?.pricePerSeat !== undefined ? String(b.pricePerSeat) : "",
    aiAddonEnabled: b?.aiAddonEnabled ?? false,
    aiPricePerSeat: b?.aiPricePerSeat !== null && b?.aiPricePerSeat !== undefined ? String(b.aiPricePerSeat) : "",
    seatsLimit: b?.seatsLimit !== null && b?.seatsLimit !== undefined ? String(b.seatsLimit) : "",
    billingEmail: b?.billingEmail ?? "",
    notes: b?.notes ?? "",
    trialEndsAt: b?.trialEndsAt ? b.trialEndsAt.split("T")[0] : "",
    subscriptionId: b?.subscriptionId ?? "",
    subscriptionStatus: b?.subscriptionStatus ?? "active",
  });
  const [savingBilling, setSavingBilling] = useState(false);

  // ── Settings handlers ──

  const toggleModule = (mod: string) => {
    setModules((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  };

  const addLevel = () => {
    const nextLevel = roleLevels.length + 1;
    setRoleLevels([...roleLevels, { id: "", name: `Level ${nextLevel}`, level: nextLevel, color: COLORS[nextLevel % COLORS.length], canApprove: true }]);
  };

  const removeLevel = (index: number) => {
    if (roleLevels.length <= 1) return;
    setRoleLevels(roleLevels.filter((_, i) => i !== index).map((l, i) => ({ ...l, level: i + 1 })));
  };

  const updateLevel = (index: number, field: string, value: string | boolean) => {
    setRoleLevels(roleLevels.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/platform/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, isActive, modules, roleLevels }),
      });
      if (res.ok) {
        toast.success("Company updated");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRegenCreds = async () => {
    setRegenLoading(true);
    try {
      const res = await fetch(`/api/platform/companies/${company.id}/credentials`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setNewCreds({ email: data.email, password: data.password });
        toast.success("Credentials regenerated");
      } else {
        toast.error("Failed to regenerate");
      }
    } finally {
      setRegenLoading(false);
    }
  };

  // ── Billing handler ──

  const handleSaveBilling = async () => {
    setSavingBilling(true);
    try {
      const res = await fetch(`/api/platform/billing/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: billingForm.plan,
          pricePerSeat: billingForm.pricePerSeat === "" ? null : Number(billingForm.pricePerSeat),
          aiAddonEnabled: billingForm.aiAddonEnabled,
          aiPricePerSeat: billingForm.aiPricePerSeat === "" ? null : Number(billingForm.aiPricePerSeat),
          seatsLimit: billingForm.seatsLimit === "" ? null : Number(billingForm.seatsLimit),
          billingEmail: billingForm.billingEmail || null,
          notes: billingForm.notes || null,
          trialEndsAt: billingForm.trialEndsAt || null,
          subscriptionId: billingForm.subscriptionId || null,
          subscriptionStatus: billingForm.subscriptionStatus,
        }),
      });
      if (res.ok) {
        toast.success("Billing settings saved!");
        router.refresh();
      } else {
        const raw = await res.text();
        let msg = "Failed";
        try {
          const data = raw ? JSON.parse(raw) : null;
          msg = data?.error || msg;
        } catch {
          // Non-JSON error response; keep generic message.
        }
        toast.error(msg);
      }
    } finally {
      setSavingBilling(false);
    }
  };

  const superAdmin = company.users[0];
  const seats = company._count.users;
  const seatsLimit = billingForm.seatsLimit ? Number(billingForm.seatsLimit) : null;
  const seatsUsedPct = seatsLimit ? Math.min(100, Math.round((seats / seatsLimit) * 100)) : null;
  const aiMonthlyTotal =
    billingForm.aiAddonEnabled && billingForm.aiPricePerSeat !== ""
      ? seats * Number(billingForm.aiPricePerSeat)
      : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <Link href="/platform/companies" className="inline-flex items-center gap-2 text-surface-400 hover:text-surface-200 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Companies
      </Link>

      <div className="space-y-5">
        {/* Header card */}
        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center font-bold text-white text-2xl">
                {company.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-surface-100">{company.name}</h1>
                <p className="text-sm text-surface-400">{company.slug}.domain.com</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500 flex-wrap">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {company._count.users} users</span>
                  <span className="flex items-center gap-1"><CheckSquare className="w-3.5 h-3.5" /> {company._count.tasks} tasks</span>
                  {(company._count.ideas ?? 0) > 0 && (
                    <span className="flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> {company._count.ideas} ideas</span>
                  )}
                </div>
              </div>
            </div>
            <Link href={`/t/${company.slug}/dashboard`} target="_blank">
              <Button size="sm" variant="outline">Open Tenant</Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-surface-800 border border-surface-700 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab("settings")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              tab === "settings"
                ? "bg-primary-500/20 text-primary-200 border border-primary-500/30 shadow-sm"
                : "text-surface-400 hover:text-surface-200"
            )}
          >
            <Settings className="w-3.5 h-3.5" /> Settings
          </button>
          <button
            onClick={() => setTab("billing")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              tab === "billing"
                ? "bg-primary-500/20 text-primary-200 border border-primary-500/30 shadow-sm"
                : "text-surface-400 hover:text-surface-200"
            )}
          >
            <CreditCard className="w-3.5 h-3.5" /> Billing
          </button>
        </div>

        {/* ── Settings Tab ── */}
        {tab === "settings" && (
          <>
            {/* Super Admin credentials */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-surface-100">Super Admin</h2>
                <Button size="sm" variant="secondary" loading={regenLoading} onClick={handleRegenCreds}>
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </Button>
              </div>
              {newCreds ? (
                <div className="space-y-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <p className="text-xs text-emerald-400 font-medium mb-2">New credentials (save now!)</p>
                  {[["Email", newCreds.email], ["Password", newCreds.password]].map(([label, value]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs text-surface-400 w-16">{label}:</span>
                      <code className="text-xs text-emerald-400 flex-1">{value}</code>
                      <button onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied!"); }} className="text-surface-400 hover:text-surface-100">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : superAdmin ? (
                <div className="flex items-center gap-3 p-3 bg-surface-750 rounded-xl">
                  <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                    {superAdmin.firstName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-200">{superAdmin.firstName} {superAdmin.lastName}</p>
                    <p className="text-xs text-surface-400">{superAdmin.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-surface-500">No super admin found. Regenerate credentials to create one.</p>
              )}
            </div>

            {/* Company settings */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-5">
              <h2 className="font-semibold text-surface-100">Settings</h2>
              <Input label="Company Name" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-200">Active Status</p>
                  <p className="text-xs text-surface-500">When inactive, users cannot log in</p>
                </div>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-6 rounded-full transition-all relative ${isActive ? "bg-primary-500" : "bg-surface-600"}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${isActive ? "left-6" : "left-0.5"}`} />
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-surface-200 mb-2">Modules</p>
                <div className="grid grid-cols-2 gap-2">
                  {["tasks", "team", "org", "approvals"].map((mod) => (
                    <button
                      key={mod}
                      onClick={() => toggleModule(mod)}
                      className={cn(
                        "text-left p-3 rounded-xl border transition-all text-sm font-medium capitalize",
                        modules.includes(mod)
                          ? "bg-primary-500/10 border-primary-500/40 text-primary-400"
                          : "bg-surface-750 border-surface-700 text-surface-500"
                      )}
                    >
                      {mod}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Role levels */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-surface-100">Hierarchy Levels</h2>
                <button onClick={addLevel} className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {roleLevels.map((level, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-surface-750 rounded-xl border border-surface-700">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: level.color }} />
                    <span className="text-xs text-surface-500 w-4 font-mono">{level.level}</span>
                    <input
                      value={level.name}
                      onChange={(e) => updateLevel(index, "name", e.target.value)}
                      className="flex-1 bg-transparent text-sm text-surface-100 focus:outline-none"
                    />
                    <input type="color" value={level.color} onChange={(e) => updateLevel(index, "color", e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                    {roleLevels.length > 1 && (
                      <button onClick={() => removeLevel(index)} className="text-surface-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} loading={saving} size="lg" className="w-full">
              <Save className="w-4 h-4" /> Save Changes
            </Button>
          </>
        )}

        {/* ── Billing Tab ── */}
        {tab === "billing" && (
          <div className="space-y-5">
            {/* Usage snapshot */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-primary-400" />
                <h2 className="font-semibold text-surface-100">Usage Snapshot</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Active Seats", value: company._count.users, icon: Users, color: "#3b82f6" },
                  { label: "Tasks Created", value: company._count.tasks, icon: CheckSquare, color: "#8b5cf6" },
                  { label: "Ideas Logged", value: company._count.ideas ?? 0, icon: Lightbulb, color: "#f59e0b" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-surface-750 rounded-xl p-4 border border-surface-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                      <span className="text-xs text-surface-400">{label}</span>
                    </div>
                    <p className="text-2xl font-bold text-surface-100">{value}</p>
                  </div>
                ))}
              </div>

              {/* Seats progress bar */}
              {seatsLimit && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-surface-400">Seat Usage</span>
                    <span className={cn("text-xs font-semibold", seatsUsedPct! >= 90 ? "text-red-400" : "text-surface-400")}>
                      {seats} / {seatsLimit} ({seatsUsedPct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", seatsUsedPct! >= 90 ? "bg-red-500" : seatsUsedPct! >= 70 ? "bg-amber-500" : "bg-primary-500")}
                      style={{ width: `${seatsUsedPct}%` }}
                    />
                  </div>
                  {seatsUsedPct! >= 90 && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Approaching seat limit — consider upgrading
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Plan selector */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary-400" />
                <h2 className="font-semibold text-surface-100">Plan & Pricing</h2>
              </div>

              {/* Plans grid */}
              <div className="grid grid-cols-2 gap-2">
                {PLANS.map((p) => {
                  const Icon = p.icon;
                  const active = billingForm.plan === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => setBillingForm({ ...billingForm, plan: p.key })}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                        active
                          ? "border-primary-500/60 bg-primary-500/10"
                          : "border-surface-700 bg-surface-750 hover:border-surface-600"
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: p.color + "22" }}>
                        <Icon className="w-4 h-4" style={{ color: p.color }} />
                      </div>
                      <span className={cn("text-sm font-semibold", active ? "text-primary-200" : "text-surface-300")}>
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Price override */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-surface-400">Price / Seat Override</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={billingForm.pricePerSeat}
                  onChange={(e) => setBillingForm({ ...billingForm, pricePerSeat: e.target.value })}
                  placeholder="Leave blank to use platform default"
                  className="w-full bg-surface-900/80 border border-surface-700/80 rounded-xl px-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-primary-500/70 transition-all"
                />
                <p className="text-[11px] text-surface-600">Empty = inherit platform default pricing</p>
              </div>

              {/* Seats limit */}
              <Input
                label="Seats Limit"
                type="number"
                min="1"
                value={billingForm.seatsLimit}
                onChange={(e) => setBillingForm({ ...billingForm, seatsLimit: e.target.value })}
                placeholder="Unlimited"
              />

              <div className="border border-surface-700 rounded-xl p-4 bg-surface-750/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-100">AI Add-on</p>
                    <p className="text-xs text-surface-500">Enable paid AI capabilities for this company.</p>
                  </div>
                  <button
                    onClick={() => setBillingForm({ ...billingForm, aiAddonEnabled: !billingForm.aiAddonEnabled })}
                    className={`w-12 h-6 rounded-full transition-all relative ${billingForm.aiAddonEnabled ? "bg-primary-500" : "bg-surface-600"}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${billingForm.aiAddonEnabled ? "left-6" : "left-0.5"}`} />
                  </button>
                </div>

                <Input
                  label="AI Price / Seat"
                  type="number"
                  min="0"
                  step="0.01"
                  value={billingForm.aiPricePerSeat}
                  onChange={(e) => setBillingForm({ ...billingForm, aiPricePerSeat: e.target.value })}
                  placeholder="e.g. 9.99"
                />
                <p className="text-[11px] text-surface-500">
                  Estimated AI monthly total:{" "}
                  <span className="text-surface-200 font-semibold">
                    {aiMonthlyTotal === null ? "—" : aiMonthlyTotal.toFixed(2)}
                  </span>{" "}
                  ({seats} active seats)
                </p>
              </div>
            </div>

            {/* Subscription details */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-surface-100">Subscription Details</h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-surface-400">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setBillingForm({ ...billingForm, subscriptionStatus: s.key })}
                        className={cn(
                          "text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all",
                          billingForm.subscriptionStatus === s.key
                            ? STATUS_CLASSES[s.key]
                            : "bg-surface-750 text-surface-500 border border-surface-700 hover:border-surface-600"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trial end */}
                <Input
                  label="Trial Ends"
                  type="date"
                  value={billingForm.trialEndsAt}
                  onChange={(e) => setBillingForm({ ...billingForm, trialEndsAt: e.target.value })}
                />
              </div>

              <Input
                label="Billing Email"
                type="email"
                value={billingForm.billingEmail}
                onChange={(e) => setBillingForm({ ...billingForm, billingEmail: e.target.value })}
                placeholder="billing@company.com"
              />
            </div>

            {/* Internal notes */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-surface-400" />
                <h2 className="font-semibold text-surface-100">Internal Notes</h2>
              </div>
              <textarea
                value={billingForm.notes}
                onChange={(e) => setBillingForm({ ...billingForm, notes: e.target.value })}
                rows={3}
                placeholder="Internal notes about this account's billing (only you can see this)…"
                className="w-full bg-surface-900/80 border border-surface-700/80 rounded-xl px-4 py-3 text-sm text-surface-100 placeholder:text-surface-600 resize-none focus:outline-none focus:border-primary-500/70 transition-all"
              />
            </div>

            {/* Stripe integration (future) */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="font-semibold text-surface-100">Stripe Integration</h2>
                <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">Future</span>
              </div>
              <p className="text-xs text-surface-500">
                Store the Stripe subscription ID to enable automatic billing sync, invoice management, and webhook updates.
              </p>
              <Input
                label="Stripe Subscription ID"
                value={billingForm.subscriptionId}
                onChange={(e) => setBillingForm({ ...billingForm, subscriptionId: e.target.value })}
                placeholder="sub_xxxxxxxxxxxxxxxx"
              />
            </div>

            <Button onClick={handleSaveBilling} loading={savingBilling} size="lg" className="w-full">
              <Save className="w-4 h-4" /> Save Billing Settings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
