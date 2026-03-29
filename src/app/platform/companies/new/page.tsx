"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ArrowLeft, Plus, Trash2, Copy } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import PlatformLayout from "@/components/layout/PlatformLayout";
import Link from "next/link";
import toast from "react-hot-toast";
import { copyToClipboard } from "@/lib/utils";

interface RoleLevelInput {
  name: string;
  level: number;
  color: string;
}

const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];
const DEFAULT_LEVELS: RoleLevelInput[] = [
  { name: "CEO", level: 1, color: "#8b5cf6" },
  { name: "Manager", level: 2, color: "#6366f1" },
  { name: "Supervisor", level: 3, color: "#3b82f6" },
  { name: "Team Member", level: 4, color: "#10b981" },
];

export default function NewCompanyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [roleLevels, setRoleLevels] = useState<RoleLevelInput[]>(DEFAULT_LEVELS);
  const [modules, setModules] = useState(["tasks", "team", "org", "approvals"]);
  const [credentials, setCredentials] = useState<{ email: string; password: string; slug: string } | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugEdited) {
      setSlug(
        value
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/-+/g, "-")
          .slice(0, 30)
      );
    }
  };

  const addLevel = () => {
    const nextLevel = roleLevels.length + 1;
    setRoleLevels([
      ...roleLevels,
      { name: `Level ${nextLevel}`, level: nextLevel, color: COLORS[nextLevel % COLORS.length] },
    ]);
  };

  const removeLevel = (index: number) => {
    if (roleLevels.length <= 1) return;
    setRoleLevels(roleLevels.filter((_, i) => i !== index).map((l, i) => ({ ...l, level: i + 1 })));
  };

  const updateLevel = (index: number, field: keyof RoleLevelInput, value: string | number) => {
    setRoleLevels(roleLevels.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const toggleModule = (mod: string) => {
    setModules((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) { toast.error("Name and slug are required"); return; }
    if (roleLevels.length < 1) { toast.error("Add at least one role level"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/platform/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, roleLevels, modules }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create"); return; }
      setCredentials(data.credentials);
      toast.success("Company created!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (credentials) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h2 className="text-xl font-bold text-surface-100">Company Created!</h2>
            <p className="text-surface-400 text-sm mt-1">
              Save these credentials — the password won&apos;t be shown again.
            </p>
          </div>
          <div className="space-y-3">
            {[
              {
                label: "Company URL",
                value: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/t/${credentials.slug}/login`,
              },
              { label: "Super Admin Email", value: credentials.email },
              { label: "Super Admin Password", value: credentials.password },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-surface-400 mb-1">{label}</p>
                <div className="flex items-center gap-2 bg-surface-900 rounded-lg px-3 py-2.5">
                  <code className="text-sm text-emerald-400 flex-1 break-all">{value}</code>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(value);
                      if (ok) toast.success("Copied!");
                      else toast.error("Could not copy — select the text manually");
                    }}
                    className="text-surface-400 hover:text-surface-100"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" className="flex-1" onClick={() => router.push("/platform/companies")}>
              Back to List
            </Button>
            <Link href={`/t/${credentials.slug}/login`} target="_blank" className="flex-1">
              <Button className="w-full">Open Tenant</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/platform/companies"
          className="inline-flex items-center gap-2 text-surface-400 hover:text-surface-200 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Companies
        </Link>

        <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-surface-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-surface-100">New Company</h1>
                <p className="text-surface-400 text-sm">Set up a new tenant company</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Basic Info</h3>
              <Input
                label="Company Name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Corp"
                required
              />
              <div>
                <Input
                  label="URL Slug (subdomain)"
                  value={slug}
                  onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugEdited(true); }}
                  placeholder="acme"
                  required
                />
                {slug && (
                  <p className="text-xs text-surface-500 mt-1.5">
                    Access at: <span className="text-primary-400">localhost:3000/t/{slug}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Modules */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Modules</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "tasks", label: "Tasks", desc: "Task management" },
                  { id: "team", label: "Team", desc: "Team directory" },
                  { id: "org", label: "Org Chart", desc: "Hierarchy view" },
                  { id: "approvals", label: "Approvals", desc: "Member requests" },
                ].map(({ id, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleModule(id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      modules.includes(id)
                        ? "bg-primary-500/10 border-primary-500/40 text-primary-400"
                        : "bg-surface-750 border-surface-700 text-surface-400 hover:border-surface-600"
                    }`}
                  >
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Role levels */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">
                  Hierarchy Levels
                </h3>
                <button
                  type="button"
                  onClick={addLevel}
                  className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add level
                </button>
              </div>
              <p className="text-xs text-surface-500">Level 1 is the top (e.g. CEO), higher numbers are below</p>
              <div className="space-y-2">
                {roleLevels.map((level, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-surface-750 rounded-xl border border-surface-700">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: level.color }}
                    />
                    <span className="text-xs text-surface-500 w-5 flex-shrink-0 font-mono">{level.level}</span>
                    <input
                      value={level.name}
                      onChange={(e) => updateLevel(index, "name", e.target.value)}
                      className="flex-1 bg-transparent text-sm text-surface-100 focus:outline-none"
                      placeholder="Level name"
                    />
                    <input
                      type="color"
                      value={level.color}
                      onChange={(e) => updateLevel(index, "color", e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    {roleLevels.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLevel(index)}
                        className="text-surface-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/platform/companies" className="flex-1">
                <Button variant="secondary" className="w-full" type="button">Cancel</Button>
              </Link>
              <Button type="submit" loading={loading} className="flex-1">
                Create Company
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
