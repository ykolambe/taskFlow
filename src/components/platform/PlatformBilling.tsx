"use client";

import { useState, useCallback } from "react";
import {
  CreditCard, DollarSign, Users, Building2, TrendingUp,
  ChevronRight, Edit2, Save, X, Check, AlertCircle,
  RefreshCw, Zap, Star, Crown, Sparkles, Globe,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface BillingConfig {
  id: string;
  defaultPricePerSeat: number;
  currency: string;
  billingCycle: string;
  updatedAt: string;
}

interface CompanyBilling {
  id: string;
  companyId: string;
  plan: string;
  pricePerSeat: number | null;
  seatsLimit: number | null;
  billingEmail: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  billing: CompanyBilling | null;
  _count: { users: number; tasks: number };
}

interface Props {
  config: BillingConfig;
  companies: Company[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const PLANS = [
  { key: "FREE",       label: "Free",       icon: Zap,       color: "#64748b", bg: "bg-surface-700/50  text-surface-300"  },
  { key: "STARTER",    label: "Starter",    icon: Star,      color: "#3b82f6", bg: "bg-blue-500/15     text-blue-300"      },
  { key: "PRO",        label: "Pro",        icon: Crown,     color: "#8b5cf6", bg: "bg-primary-500/15  text-primary-300"   },
  { key: "ENTERPRISE", label: "Enterprise", icon: Sparkles,  color: "#f59e0b", bg: "bg-amber-500/15    text-amber-300"     },
] as const;

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD"];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active:   { label: "Active",   className: "bg-emerald-500/15 text-emerald-300" },
  trialing: { label: "Trial",    className: "bg-blue-500/15    text-blue-300"    },
  past_due: { label: "Past Due", className: "bg-red-500/15     text-red-300"     },
  canceled: { label: "Canceled", className: "bg-surface-700    text-surface-400" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(amount);
}

function getPlan(key: string) {
  return PLANS.find((p) => p.key === key) ?? PLANS[0];
}

function effectivePrice(company: Company, defaultPrice: number) {
  return company.billing?.pricePerSeat ?? defaultPrice;
}

function monthlyRevenue(company: Company, defaultPrice: number, billingCycle: string) {
  const price = effectivePrice(company, defaultPrice);
  const seats = company._count.users;
  return billingCycle === "annual" ? (price * seats * 12) / 12 : price * seats;
}

// ── Plan Badge ───────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const p = getPlan(plan);
  const Icon = p.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide", p.bg)}>
      <Icon className="w-3 h-3" />
      {p.label}
    </span>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function BillingStatCard({
  label, value, sub, icon: Icon, accentColor,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accentColor: string;
}) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5 relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-4 translate-x-4"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + "22" }}>
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-surface-100 font-display">{value}</p>
      {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Inline Company Row Edit Modal ────────────────────────────────────────────

function EditCompanyBillingModal({
  company, defaultPrice, currency, onSave, onClose,
}: {
  company: Company;
  defaultPrice: number;
  currency: string;
  onSave: (companyId: string, data: Partial<CompanyBilling>) => Promise<void>;
  onClose: () => void;
}) {
  const b = company.billing;
  const [form, setForm] = useState({
    plan: b?.plan ?? "FREE",
    pricePerSeat: b?.pricePerSeat !== null && b?.pricePerSeat !== undefined ? String(b.pricePerSeat) : "",
    seatsLimit: b?.seatsLimit !== null && b?.seatsLimit !== undefined ? String(b.seatsLimit) : "",
    billingEmail: b?.billingEmail ?? "",
    subscriptionStatus: b?.subscriptionStatus ?? "active",
    trialEndsAt: b?.trialEndsAt ? b.trialEndsAt.split("T")[0] : "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(company.id, {
        plan: form.plan,
        pricePerSeat: form.pricePerSeat === "" ? null : (Number(form.pricePerSeat) as any),
        seatsLimit: form.seatsLimit === "" ? null : (Number(form.seatsLimit) as any),
        billingEmail: form.billingEmail || null,
        subscriptionStatus: form.subscriptionStatus,
        trialEndsAt: form.trialEndsAt || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800">
          <div>
            <h3 className="font-bold text-surface-100">{company.name}</h3>
            <p className="text-xs text-surface-500 mt-0.5">Override billing settings</p>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Plan */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-surface-400">Plan</label>
            <div className="grid grid-cols-2 gap-2">
              {PLANS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.key}
                    onClick={() => setForm({ ...form, plan: p.key })}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                      form.plan === p.key
                        ? "border-primary-500/60 bg-primary-500/10 text-primary-200"
                        : "border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-600"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: form.plan === p.key ? p.color : undefined }} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price override */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-surface-400">
              Price / Seat ({currency})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 text-sm">{currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : ""}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.pricePerSeat}
                onChange={(e) => setForm({ ...form, pricePerSeat: e.target.value })}
                placeholder={`Default: ${defaultPrice}`}
                className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-8 pr-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-primary-500/70 transition-all"
              />
            </div>
            <p className="text-[11px] text-surface-600">Leave blank to inherit the platform default ({formatCurrency(defaultPrice, currency)}/seat)</p>
          </div>

          {/* Seats limit */}
          <Input
            label="Seats Limit"
            type="number"
            min="1"
            value={form.seatsLimit}
            onChange={(e) => setForm({ ...form, seatsLimit: e.target.value })}
            placeholder="Unlimited"
          />

          {/* Billing email */}
          <Input
            label="Billing Email"
            type="email"
            value={form.billingEmail}
            onChange={(e) => setForm({ ...form, billingEmail: e.target.value })}
            placeholder="billing@company.com"
          />

          {/* Status + trial */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-surface-400">Status</label>
              <select
                value={form.subscriptionStatus}
                onChange={(e) => setForm({ ...form, subscriptionStatus: e.target.value })}
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-100 focus:outline-none focus:border-primary-500/70 transition-all"
              >
                <option value="active">Active</option>
                <option value="trialing">Trial</option>
                <option value="past_due">Past Due</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            <Input
              label="Trial Ends"
              type="date"
              value={form.trialEndsAt}
              onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
          <Button size="sm" loading={saving} onClick={handleSave} className="flex-1">
            <Check className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlatformBilling({ config: initialConfig, companies: initialCompanies }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [companies, setCompanies] = useState(initialCompanies);
  const [tab, setTab] = useState<"overview" | "companies">("overview");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    defaultPricePerSeat: String(initialConfig.defaultPricePerSeat),
    currency: initialConfig.currency,
    billingCycle: initialConfig.billingCycle,
  });
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");

  // Aggregate stats
  const activeCompanies = companies.filter((c) => c.isActive);
  const totalSeats = companies.reduce((s, c) => s + c._count.users, 0);
  const estimatedMRR = activeCompanies.reduce(
    (s, c) => s + monthlyRevenue(c, config.defaultPricePerSeat, config.billingCycle),
    0
  );
  const avgRevenuePerCompany = activeCompanies.length
    ? estimatedMRR / activeCompanies.length
    : 0;

  const filteredCompanies = companies.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.slug.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPlan !== "all" && (c.billing?.plan ?? "FREE") !== filterPlan) return false;
    return true;
  });

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/platform/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultPricePerSeat: Number(configForm.defaultPricePerSeat),
          currency: configForm.currency,
          billingCycle: configForm.billingCycle,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfig(data.config);
        toast.success("Billing config saved!");
        router.refresh();
      } else {
        toast.error(data.error || "Failed to save");
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveCompanyBilling = useCallback(async (companyId: string, updates: Partial<CompanyBilling>) => {
    const res = await fetch(`/api/platform/billing/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (res.ok) {
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, billing: data.billing } : c))
      );
      toast.success("Billing updated!");
    } else {
      toast.error(data.error || "Failed to update");
      throw new Error(data.error);
    }
  }, []);

  const currencySymbol = config.currency === "USD" ? "$" : config.currency === "EUR" ? "€" : config.currency === "GBP" ? "£" : config.currency;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-primary-400" />
            Billing & Usage
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            Manage pricing, plans, and usage across all tenant companies.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-xs text-surface-400">
          <Globe className="w-3.5 h-3.5" />
          <span>Default: <strong className="text-surface-200">{formatCurrency(config.defaultPricePerSeat, config.currency)}</strong>/seat/{config.billingCycle}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BillingStatCard
          label="Est. MRR"
          value={formatCurrency(estimatedMRR, config.currency)}
          sub={`Based on ${config.billingCycle} billing`}
          icon={TrendingUp}
          accentColor="#10b981"
        />
        <BillingStatCard
          label="Total Seats"
          value={String(totalSeats)}
          sub={`Across ${companies.length} workspaces`}
          icon={Users}
          accentColor="#3b82f6"
        />
        <BillingStatCard
          label="Active"
          value={String(activeCompanies.length)}
          sub={`${companies.length - activeCompanies.length} inactive`}
          icon={Building2}
          accentColor="#8b5cf6"
        />
        <BillingStatCard
          label="Avg / Company"
          value={formatCurrency(avgRevenuePerCompany, config.currency)}
          sub="Monthly revenue avg"
          icon={DollarSign}
          accentColor="#f59e0b"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-800 border border-surface-700 rounded-xl p-1 w-fit">
        {(["overview", "companies"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all",
              tab === t
                ? "bg-primary-500/20 text-primary-200 border border-primary-500/30 shadow-sm"
                : "text-surface-400 hover:text-surface-200"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {tab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Default Pricing Card */}
          <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary-400" />
              <h2 className="font-bold text-surface-100">Default Pricing</h2>
            </div>
            <p className="text-xs text-surface-500 -mt-2">
              Applied to all companies that don&apos;t have a per-seat override.
            </p>

            <div className="space-y-4">
              {/* Price per seat */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-surface-400">
                  Default Price / Seat
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 font-medium">{currencySymbol}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={configForm.defaultPricePerSeat}
                    onChange={(e) => setConfigForm({ ...configForm, defaultPricePerSeat: e.target.value })}
                    className="w-full bg-surface-900/80 border border-surface-700/80 rounded-xl pl-9 pr-4 py-3 text-surface-100 text-sm focus:outline-none focus:border-primary-500/70 transition-all"
                  />
                </div>
              </div>

              {/* Currency + billing cycle */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-surface-400">Currency</label>
                  <select
                    value={configForm.currency}
                    onChange={(e) => setConfigForm({ ...configForm, currency: e.target.value })}
                    className="w-full bg-surface-900/80 border border-surface-700/80 rounded-xl px-4 py-3 text-sm text-surface-100 focus:outline-none focus:border-primary-500/70 transition-all"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-surface-400">Billing Cycle</label>
                  <select
                    value={configForm.billingCycle}
                    onChange={(e) => setConfigForm({ ...configForm, billingCycle: e.target.value })}
                    className="w-full bg-surface-900/80 border border-surface-700/80 rounded-xl px-4 py-3 text-sm text-surface-100 focus:outline-none focus:border-primary-500/70 transition-all"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <Button onClick={handleSaveConfig} loading={savingConfig} size="sm">
                <Save className="w-3.5 h-3.5" /> Save Default Pricing
              </Button>
            </div>
          </div>

          {/* Plan distribution + quick tips */}
          <div className="space-y-4">
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6">
              <h2 className="font-bold text-surface-100 mb-4">Plan Distribution</h2>
              <div className="space-y-3">
                {PLANS.map((p) => {
                  const Icon = p.icon;
                  const count = companies.filter((c) => (c.billing?.plan ?? "FREE") === p.key).length;
                  const pct = companies.length ? Math.round((count / companies.length) * 100) : 0;
                  return (
                    <div key={p.key} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: p.color + "22" }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: p.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-surface-300">{p.label}</span>
                          <span className="text-xs text-surface-500">{count} workspace{count !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: p.color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stripe ready note */}
            <div className="bg-primary-500/5 border border-primary-500/20 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-primary-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary-200">Stripe-Ready Architecture</p>
                  <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                    Each company record holds a <code className="bg-surface-800 px-1 rounded text-primary-300 text-[10px]">subscriptionId</code> and <code className="bg-surface-800 px-1 rounded text-primary-300 text-[10px]">subscriptionStatus</code> field ready for Stripe webhook integration. Connect Stripe to auto-sync plans and invoices.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Companies ── */}
      {tab === "companies" && (
        <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden">
          {/* Table header / filters */}
          <div className="px-5 py-4 border-b border-surface-700 flex flex-col sm:flex-row gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies…"
              className="flex-1 bg-surface-900/80 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500/70 transition-all"
            />
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="bg-surface-900/80 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-100 focus:outline-none focus:border-primary-500/70 transition-all"
            >
              <option value="all">All Plans</option>
              {PLANS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-surface-500 border-b border-surface-700/50">
                  <th className="text-left px-5 py-3 font-semibold">Company</th>
                  <th className="text-left px-4 py-3 font-semibold">Plan</th>
                  <th className="text-center px-4 py-3 font-semibold">Seats</th>
                  <th className="text-right px-4 py-3 font-semibold">Price / Seat</th>
                  <th className="text-right px-4 py-3 font-semibold">Est. MRR</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-surface-600 text-sm">
                      No companies match your search.
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((company) => {
                    const plan = company.billing?.plan ?? "FREE";
                    const seats = company._count.users;
                    const seatsLimit = company.billing?.seatsLimit;
                    const price = effectivePrice(company, config.defaultPricePerSeat);
                    const mrr = monthlyRevenue(company, config.defaultPricePerSeat, config.billingCycle);
                    const hasOverride = company.billing?.pricePerSeat !== null && company.billing?.pricePerSeat !== undefined;
                    const status = company.billing?.subscriptionStatus ?? "active";
                    const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;

                    return (
                      <tr
                        key={company.id}
                        className="border-b border-surface-700/30 hover:bg-surface-750/50 transition-colors"
                      >
                        {/* Company */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
                              company.isActive ? "bg-gradient-to-br from-primary-500 to-purple-600" : "bg-surface-600"
                            )}>
                              {company.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-surface-100">{company.name}</p>
                              <p className="text-xs text-surface-500 font-mono">{company.slug}</p>
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-4">
                          <PlanBadge plan={plan} />
                        </td>

                        {/* Seats */}
                        <td className="px-4 py-4 text-center">
                          <span className="font-semibold text-surface-200">{seats}</span>
                          {seatsLimit && (
                            <span className="text-surface-500 text-xs"> / {seatsLimit}</span>
                          )}
                          {seatsLimit && seats >= seatsLimit && (
                            <span className="inline-flex ml-1 align-middle" title="At seat limit">
                              <AlertCircle className="w-3.5 h-3.5 text-red-400" aria-hidden />
                            </span>
                          )}
                        </td>

                        {/* Price / seat */}
                        <td className="px-4 py-4 text-right">
                          <span className={cn("font-semibold", hasOverride ? "text-accent-300" : "text-surface-400")}>
                            {formatCurrency(price, config.currency)}
                          </span>
                          {hasOverride && (
                            <p className="text-[10px] text-accent-500">custom</p>
                          )}
                        </td>

                        {/* MRR */}
                        <td className="px-4 py-4 text-right">
                          <span className="font-bold text-emerald-400">
                            {formatCurrency(mrr, config.currency)}
                          </span>
                          <p className="text-[10px] text-surface-600">/mo</p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 text-center">
                          <span className={cn("inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full", statusCfg.className)}>
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* Edit */}
                        <td className="px-4 py-4">
                          <button
                            onClick={() => setEditingCompany(company)}
                            className="flex items-center gap-1 text-xs text-surface-500 hover:text-primary-400 transition-colors"
                            title="Edit billing"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Footer totals */}
              {filteredCompanies.length > 0 && (
                <tfoot className="border-t border-surface-700 bg-surface-900/50">
                  <tr className="text-xs text-surface-400 font-semibold">
                    <td className="px-5 py-3">{filteredCompanies.length} companies</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-center">
                      {filteredCompanies.reduce((s, c) => s + c._count.users, 0)} seats
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                      {formatCurrency(
                        filteredCompanies.reduce((s, c) => s + monthlyRevenue(c, config.defaultPricePerSeat, config.billingCycle), 0),
                        config.currency
                      )}
                    </td>
                    <td className="px-4 py-3" colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingCompany && (
        <EditCompanyBillingModal
          company={editingCompany}
          defaultPrice={config.defaultPricePerSeat}
          currency={config.currency}
          onSave={handleSaveCompanyBilling}
          onClose={() => setEditingCompany(null)}
        />
      )}
    </div>
  );
}
