"use client";

import { useEffect, useState } from "react";
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
import { cn, copyToClipboard } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface CompanyBilling {
  id?: string;
  plan: string;
  pricePerSeat: number | null;
  aiAddonEnabled: boolean;
  aiPricePerSeat: number | null;
  chatAddonEnabled: boolean;
  chatPricePerSeat: number | null;
  recurringAddonEnabled: boolean;
  recurringPricePerSeat: number | null;
  contentStudioAddonEnabled: boolean;
  contentStudioPricePerSeat: number | null;
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
  infraConfig: {
    deploymentMode: "SHARED" | "DEDICATED";
    provisioningStatus: "PENDING" | "PROVISIONING" | "READY" | "FAILED";
    provisioningError: string | null;
    backendBaseUrl: string | null;
    backendIp: string | null;
    frontendBaseUrl: string | null;
    frontendIp: string | null;
    dbHost: string | null;
    dbPort: number | null;
    dbName: string | null;
    dbUserSecretRef: string | null;
    dbPasswordSecretRef: string | null;
    dbUrlSecretRef: string | null;
    aiProvider: string | null;
    aiModel: string | null;
    aiApiKeySecretRef: string | null;
    aiBaseUrl: string | null;
    aiRequestBudgetDaily: number | null;
  } | null;
  _count: { users: number; tasks: number; ideas?: number; recurringTasks?: number };
  roleLevels: { id: string; name: string; level: number; color: string; canApprove: boolean }[];
  users: { id: string; email: string; firstName: string; lastName: string }[];
}

type ProvisioningStepLog = {
  at?: string;
  step?: string;
  status?: "started" | "success" | "skipped" | "failed" | string;
  message?: string;
};

type ProvisioningJob = {
  id: string;
  action: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  payload?: { stepLogs?: ProvisioningStepLog[] } | null;
  lastError?: string | null;
};

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
    chatAddonEnabled: b?.chatAddonEnabled ?? false,
    chatPricePerSeat: b?.chatPricePerSeat !== null && b?.chatPricePerSeat !== undefined ? String(b.chatPricePerSeat) : "",
    recurringAddonEnabled: b?.recurringAddonEnabled ?? false,
    recurringPricePerSeat: b?.recurringPricePerSeat !== null && b?.recurringPricePerSeat !== undefined ? String(b.recurringPricePerSeat) : "",
    contentStudioAddonEnabled: b?.contentStudioAddonEnabled ?? false,
    contentStudioPricePerSeat:
      b?.contentStudioPricePerSeat !== null && b?.contentStudioPricePerSeat !== undefined ? String(b.contentStudioPricePerSeat) : "",
    seatsLimit: b?.seatsLimit !== null && b?.seatsLimit !== undefined ? String(b.seatsLimit) : "",
    billingEmail: b?.billingEmail ?? "",
    notes: b?.notes ?? "",
    trialEndsAt: b?.trialEndsAt ? b.trialEndsAt.split("T")[0] : "",
    subscriptionId: b?.subscriptionId ?? "",
    subscriptionStatus: b?.subscriptionStatus ?? "active",
  });
  const [savingBilling, setSavingBilling] = useState(false);
  const [savingInfra, setSavingInfra] = useState(false);
  const [triggeringProvision, setTriggeringProvision] = useState(false);
  const [runningProvisioningNow, setRunningProvisioningNow] = useState(false);
  const [rebuildingTenantDbNow, setRebuildingTenantDbNow] = useState(false);
  const [updatingProvisioningStatus, setUpdatingProvisioningStatus] = useState(false);
  const [provisioningStatusDraft, setProvisioningStatusDraft] = useState<
    "PENDING" | "PROVISIONING" | "READY" | "FAILED"
  >(company.infraConfig?.provisioningStatus ?? "PENDING");
  const [provisioningErrorDraft, setProvisioningErrorDraft] = useState(company.infraConfig?.provisioningError ?? "");
  const [infraForm, setInfraForm] = useState({
    deploymentMode: company.infraConfig?.deploymentMode ?? "SHARED",
    backendBaseUrl: company.infraConfig?.backendBaseUrl ?? "",
    backendIp: company.infraConfig?.backendIp ?? "",
    frontendBaseUrl: company.infraConfig?.frontendBaseUrl ?? "",
    frontendIp: company.infraConfig?.frontendIp ?? "",
    dbHost: company.infraConfig?.dbHost ?? "",
    dbPort: company.infraConfig?.dbPort !== null && company.infraConfig?.dbPort !== undefined ? String(company.infraConfig.dbPort) : "",
    dbName: company.infraConfig?.dbName ?? "",
    dbUserSecretRef: company.infraConfig?.dbUserSecretRef ?? "",
    dbPasswordSecretRef: company.infraConfig?.dbPasswordSecretRef ?? "",
    dbUrlSecretRef: company.infraConfig?.dbUrlSecretRef ?? "",
    aiProvider: company.infraConfig?.aiProvider ?? "gemini",
    aiModel: company.infraConfig?.aiModel ?? "",
    aiApiKeySecretRef: company.infraConfig?.aiApiKeySecretRef ?? "",
    aiBaseUrl: company.infraConfig?.aiBaseUrl ?? "",
    aiRequestBudgetDaily:
      company.infraConfig?.aiRequestBudgetDaily !== null && company.infraConfig?.aiRequestBudgetDaily !== undefined
        ? String(company.infraConfig.aiRequestBudgetDaily)
        : "",
  });
  const [provisioningJobs, setProvisioningJobs] = useState<ProvisioningJob[]>([]);
  const [loadingProvisioningJobs, setLoadingProvisioningJobs] = useState(false);

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
          chatAddonEnabled: billingForm.chatAddonEnabled,
          chatPricePerSeat: billingForm.chatPricePerSeat === "" ? null : Number(billingForm.chatPricePerSeat),
          recurringAddonEnabled: billingForm.recurringAddonEnabled,
          recurringPricePerSeat: billingForm.recurringPricePerSeat === "" ? null : Number(billingForm.recurringPricePerSeat),
          contentStudioAddonEnabled: billingForm.contentStudioAddonEnabled,
          contentStudioPricePerSeat:
            billingForm.contentStudioPricePerSeat === "" ? null : Number(billingForm.contentStudioPricePerSeat),
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

  const handleSaveInfra = async () => {
    setSavingInfra(true);
    try {
      const res = await fetch(`/api/platform/companies/${company.id}/infra`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deploymentMode: infraForm.deploymentMode,
          backendBaseUrl: infraForm.backendBaseUrl || null,
          backendIp: infraForm.backendIp || null,
          frontendBaseUrl: infraForm.frontendBaseUrl || null,
          frontendIp: infraForm.frontendIp || null,
          dbHost: infraForm.dbHost || null,
          dbPort: infraForm.dbPort ? Number(infraForm.dbPort) : null,
          dbName: infraForm.dbName || null,
          dbUserSecretRef: infraForm.dbUserSecretRef || null,
          dbPasswordSecretRef: infraForm.dbPasswordSecretRef || null,
          dbUrlSecretRef: infraForm.dbUrlSecretRef || null,
          aiProvider: infraForm.aiProvider || null,
          aiModel: infraForm.aiModel || null,
          aiApiKeySecretRef: infraForm.aiApiKeySecretRef || null,
          aiBaseUrl: infraForm.aiBaseUrl || null,
          aiRequestBudgetDaily: infraForm.aiRequestBudgetDaily ? Number(infraForm.aiRequestBudgetDaily) : null,
        }),
      });
      if (res.ok) {
        toast.success("Infrastructure config saved");
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to save infra config");
      }
    } finally {
      setSavingInfra(false);
    }
  };

  const handleTriggerProvision = async () => {
    setTriggeringProvision(true);
    try {
      const idempotencyKey = `company-${company.id}-${Date.now()}`;
      const res = await fetch(`/api/platform/companies/${company.id}/provisioning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PROVISION", idempotencyKey }),
      });
      if (res.ok) {
        toast.success("Provisioning queued");
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to queue provisioning");
      }
    } finally {
      setTriggeringProvision(false);
    }
  };

  const handleUpdateProvisioningStatus = async () => {
    setUpdatingProvisioningStatus(true);
    try {
      const res = await fetch(`/api/platform/companies/${company.id}/provisioning/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: provisioningStatusDraft,
          error: provisioningErrorDraft.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success("Provisioning status updated");
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to update provisioning status");
      }
    } finally {
      setUpdatingProvisioningStatus(false);
    }
  };

  const handleRunProvisioningNow = async () => {
    setRunningProvisioningNow(true);
    try {
      const res = await fetch(`/api/platform/provisioning/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const processed = Number(data?.processed ?? 0);
        toast.success(processed > 0 ? `Provisioning ran (${processed} job${processed > 1 ? "s" : ""})` : "No pending provisioning jobs");
        await loadProvisioningJobs();
        router.refresh();
      } else {
        toast.error(data?.error || "Failed to run provisioning");
      }
    } finally {
      setRunningProvisioningNow(false);
    }
  };

  const handleRebuildTenantDbNow = async () => {
    setRebuildingTenantDbNow(true);
    try {
      const idempotencyKey = `rebuild-db-${company.id}-${Date.now()}`;
      const queueRes = await fetch(`/api/platform/companies/${company.id}/provisioning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REPROVISION",
          idempotencyKey,
          payload: { forceDbBootstrap: true },
        }),
      });
      const queueJson = await queueRes.json().catch(() => null);
      if (!queueRes.ok) {
        toast.error(queueJson?.error || "Failed to queue DB rebuild");
        return;
      }

      const runRes = await fetch(`/api/platform/provisioning/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const runJson = await runRes.json().catch(() => null);
      if (!runRes.ok) {
        toast.error(runJson?.error || "DB rebuild queued, but run failed");
        await loadProvisioningJobs();
        router.refresh();
        return;
      }

      const processed = Number(runJson?.processed ?? 0);
      toast.success(processed > 0 ? "Tenant DB rebuild started" : "DB rebuild queued");
      await loadProvisioningJobs();
      router.refresh();
    } finally {
      setRebuildingTenantDbNow(false);
    }
  };

  const loadProvisioningJobs = async () => {
    setLoadingProvisioningJobs(true);
    try {
      const res = await fetch(`/api/platform/companies/${company.id}/provisioning`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error || "Failed to load provisioning timeline");
        return;
      }
      setProvisioningJobs(Array.isArray(json?.data?.jobs) ? (json.data.jobs as ProvisioningJob[]) : []);
    } finally {
      setLoadingProvisioningJobs(false);
    }
  };

  useEffect(() => {
    void loadProvisioningJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

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
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copyToClipboard(value);
                          if (ok) toast.success("Copied!");
                          else toast.error("Could not copy — select the text manually");
                        }}
                        className="text-surface-400 hover:text-surface-100"
                      >
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
                  {["tasks", "team", "org", "approvals", "chat", "recurring"].map((mod) => (
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

            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-surface-100">Tenant Infrastructure</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-surface-400">Deployment Mode</label>
                  <select
                    value={infraForm.deploymentMode}
                    onChange={(e) => setInfraForm((prev) => ({ ...prev, deploymentMode: e.target.value as "SHARED" | "DEDICATED" }))}
                    className="w-full bg-surface-900 border border-surface-700 rounded-xl px-3 py-2 text-sm text-surface-100"
                  >
                    <option value="SHARED">SHARED</option>
                    <option value="DEDICATED">DEDICATED</option>
                  </select>
                </div>
                <Input label="Backend URL" value={infraForm.backendBaseUrl} onChange={(e) => setInfraForm((prev) => ({ ...prev, backendBaseUrl: e.target.value }))} />
                <Input label="Frontend URL" value={infraForm.frontendBaseUrl} onChange={(e) => setInfraForm((prev) => ({ ...prev, frontendBaseUrl: e.target.value }))} />
                <Input label="Backend IP" value={infraForm.backendIp} onChange={(e) => setInfraForm((prev) => ({ ...prev, backendIp: e.target.value }))} />
                <Input label="Frontend IP" value={infraForm.frontendIp} onChange={(e) => setInfraForm((prev) => ({ ...prev, frontendIp: e.target.value }))} />
                <Input label="DB Host" value={infraForm.dbHost} onChange={(e) => setInfraForm((prev) => ({ ...prev, dbHost: e.target.value }))} />
                <Input label="DB Port" value={infraForm.dbPort} onChange={(e) => setInfraForm((prev) => ({ ...prev, dbPort: e.target.value }))} />
                <Input label="DB Name" value={infraForm.dbName} onChange={(e) => setInfraForm((prev) => ({ ...prev, dbName: e.target.value }))} />
                <Input label="DB User Secret Ref" value={infraForm.dbUserSecretRef} onChange={(e) => setInfraForm((prev) => ({ ...prev, dbUserSecretRef: e.target.value }))} />
                <Input label="DB Password Secret Ref" value={infraForm.dbPasswordSecretRef} onChange={(e) => setInfraForm((prev) => ({ ...prev, dbPasswordSecretRef: e.target.value }))} />
                <Input label="DB URL Secret Ref" value={infraForm.dbUrlSecretRef} onChange={(e) => setInfraForm((prev) => ({ ...prev, dbUrlSecretRef: e.target.value }))} />
                <Input label="AI Provider" value={infraForm.aiProvider} onChange={(e) => setInfraForm((prev) => ({ ...prev, aiProvider: e.target.value }))} />
                <Input label="AI Model" value={infraForm.aiModel} onChange={(e) => setInfraForm((prev) => ({ ...prev, aiModel: e.target.value }))} />
                <Input label="AI Key Secret Ref" value={infraForm.aiApiKeySecretRef} onChange={(e) => setInfraForm((prev) => ({ ...prev, aiApiKeySecretRef: e.target.value }))} />
                <Input label="AI Base URL" value={infraForm.aiBaseUrl} onChange={(e) => setInfraForm((prev) => ({ ...prev, aiBaseUrl: e.target.value }))} />
                <Input
                  label="AI Daily Request Budget"
                  value={infraForm.aiRequestBudgetDaily}
                  onChange={(e) => setInfraForm((prev) => ({ ...prev, aiRequestBudgetDaily: e.target.value }))}
                />
              </div>
              <div className="text-xs text-surface-400">
                Status: <span className="font-semibold text-surface-200">{provisioningStatusDraft}</span>
                {company.infraConfig?.provisioningError ? ` - ${company.infraConfig.provisioningError}` : ""}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-surface-400">Manual Provisioning Status</label>
                  <select
                    value={provisioningStatusDraft}
                    onChange={(e) =>
                      setProvisioningStatusDraft(
                        e.target.value as "PENDING" | "PROVISIONING" | "READY" | "FAILED"
                      )
                    }
                    className="w-full bg-surface-900 border border-surface-700 rounded-xl px-3 py-2 text-sm text-surface-100"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PROVISIONING">PROVISIONING</option>
                    <option value="READY">READY</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>
                <Input
                  label="Status Error/Note"
                  value={provisioningErrorDraft}
                  onChange={(e) => setProvisioningErrorDraft(e.target.value)}
                  placeholder="Optional error or note"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveInfra} loading={savingInfra} size="sm">
                  <Save className="w-4 h-4" /> Save Infra
                </Button>
                <Button onClick={handleTriggerProvision} loading={triggeringProvision} size="sm" variant="secondary">
                  <RefreshCw className="w-4 h-4" /> Queue Provision
                </Button>
                <Button onClick={handleRunProvisioningNow} loading={runningProvisioningNow} size="sm" variant="secondary">
                  Run Now
                </Button>
                <Button onClick={handleRebuildTenantDbNow} loading={rebuildingTenantDbNow} size="sm" variant="outline">
                  Rebuild Tenant DB Now
                </Button>
                <Button onClick={handleUpdateProvisioningStatus} loading={updatingProvisioningStatus} size="sm" variant="outline">
                  Update Status
                </Button>
                <Button onClick={loadProvisioningJobs} loading={loadingProvisioningJobs} size="sm" variant="ghost">
                  Refresh Timeline
                </Button>
              </div>
            </div>

            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-surface-100">Provisioning Timeline</h2>
                <span className="text-xs text-surface-500">{provisioningJobs.length} jobs</span>
              </div>
              {provisioningJobs.length === 0 ? (
                <p className="text-sm text-surface-500">No provisioning jobs yet.</p>
              ) : (
                <div className="space-y-3">
                  {provisioningJobs.slice(0, 8).map((job) => {
                    const stepLogs = Array.isArray(job.payload?.stepLogs) ? job.payload?.stepLogs ?? [] : [];
                    return (
                      <div key={job.id} className="rounded-xl border border-surface-700 bg-surface-750/50 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-surface-200 font-medium">
                            {job.action} - {job.status}
                          </div>
                          <div className="text-[11px] text-surface-500">
                            {new Date(job.createdAt).toLocaleString()}
                          </div>
                        </div>
                        {job.lastError ? (
                          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                            {job.lastError}
                          </div>
                        ) : null}
                        {stepLogs.length === 0 ? (
                          <p className="text-xs text-surface-500">No step logs captured.</p>
                        ) : (
                          <div className="space-y-2">
                            {stepLogs.map((log, idx) => (
                              <div key={`${job.id}-${idx}`} className="flex items-start gap-2">
                                <span
                                  className={cn(
                                    "mt-0.5 inline-flex h-2 w-2 rounded-full",
                                    log.status === "success"
                                      ? "bg-emerald-400"
                                      : log.status === "failed"
                                      ? "bg-red-400"
                                      : log.status === "skipped"
                                      ? "bg-amber-400"
                                      : "bg-blue-400"
                                  )}
                                />
                                <div className="min-w-0">
                                  <p className="text-xs text-surface-200">
                                    {log.step ?? "step"}{" "}
                                    <span className="text-surface-500">({log.status ?? "started"})</span>
                                  </p>
                                  {log.message ? <p className="text-[11px] text-surface-500">{log.message}</p> : null}
                                  {log.at ? (
                                    <p className="text-[10px] text-surface-600">{new Date(log.at).toLocaleString()}</p>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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

              <div className="border border-surface-700 rounded-xl p-4 bg-surface-750/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-100">Chat Add-on</p>
                    <p className="text-xs text-surface-500">Enable paid team chat module.</p>
                  </div>
                  <button
                    onClick={() => setBillingForm({ ...billingForm, chatAddonEnabled: !billingForm.chatAddonEnabled })}
                    className={`w-12 h-6 rounded-full transition-all relative ${billingForm.chatAddonEnabled ? "bg-primary-500" : "bg-surface-600"}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${billingForm.chatAddonEnabled ? "left-6" : "left-0.5"}`} />
                  </button>
                </div>
                <Input
                  label="Chat Price / Seat"
                  type="number"
                  min="0"
                  step="0.01"
                  value={billingForm.chatPricePerSeat}
                  onChange={(e) => setBillingForm({ ...billingForm, chatPricePerSeat: e.target.value })}
                  placeholder="e.g. 4.99"
                />
              </div>

              <div className="border border-surface-700 rounded-xl p-4 bg-surface-750/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-100">Recurring Add-on</p>
                    <p className="text-xs text-surface-500">Enable paid recurring tasks module.</p>
                  </div>
                  <button
                    onClick={() => setBillingForm({ ...billingForm, recurringAddonEnabled: !billingForm.recurringAddonEnabled })}
                    className={`w-12 h-6 rounded-full transition-all relative ${billingForm.recurringAddonEnabled ? "bg-primary-500" : "bg-surface-600"}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${billingForm.recurringAddonEnabled ? "left-6" : "left-0.5"}`} />
                  </button>
                </div>
                <Input
                  label="Recurring Price / Seat"
                  type="number"
                  min="0"
                  step="0.01"
                  value={billingForm.recurringPricePerSeat}
                  onChange={(e) => setBillingForm({ ...billingForm, recurringPricePerSeat: e.target.value })}
                  placeholder="e.g. 2.99"
                />
              </div>

              <div className="border border-surface-700 rounded-xl p-4 bg-surface-750/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-100">Content Studio Add-on</p>
                    <p className="text-xs text-surface-500">Channel calendars, editorial workflow, and approvals.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setBillingForm({
                        ...billingForm,
                        contentStudioAddonEnabled: !billingForm.contentStudioAddonEnabled,
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-all relative ${billingForm.contentStudioAddonEnabled ? "bg-primary-500" : "bg-surface-600"}`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${billingForm.contentStudioAddonEnabled ? "left-6" : "left-0.5"}`}
                    />
                  </button>
                </div>
                <Input
                  label="Content Studio Price / Seat"
                  type="number"
                  min="0"
                  step="0.01"
                  value={billingForm.contentStudioPricePerSeat}
                  onChange={(e) => setBillingForm({ ...billingForm, contentStudioPricePerSeat: e.target.value })}
                  placeholder="e.g. 5.99"
                />
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
