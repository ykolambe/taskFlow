"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Building2, Users, CheckSquare, ArrowRight, MoreVertical, Copy, RefreshCw, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff } from "lucide-react";
import { formatRelative, copyToClipboard } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface Company {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  modules: string[];
  createdAt: Date;
  _count: { users: number; tasks: number };
  roleLevels: { id: string; name: string; level: number; color: string }[];
}

export default function CompanyList({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [credModal, setCredModal] = useState<{
    companyId: string;
    email: string;
    password: string;
    slug: string;
  } | null>(null);

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleActive = async (id: string, current: boolean) => {
    const res = await fetch(`/api/platform/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    if (res.ok) {
      toast.success(current ? "Company deactivated" : "Company activated");
      router.refresh();
    } else {
      toast.error("Failed to update");
    }
    setMenuOpen(null);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/platform/companies/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Company deleted");
      router.refresh();
    } else {
      toast.error("Failed to delete");
    }
    setConfirmDelete(null);
  };

  const handleRegenerateCreds = async (id: string) => {
    const res = await fetch(`/api/platform/companies/${id}/credentials`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setCredModal({ ...data, companyId: id });
    } else {
      toast.error("Failed to regenerate credentials");
    }
    setMenuOpen(null);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Companies</h1>
          <p className="text-surface-400 text-sm mt-1">
            {companies.length} tenant{companies.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link href="/platform/companies/new">
          <Button>
            <Plus className="w-4 h-4" /> New Company
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-surface-800 border border-surface-700 rounded-2xl py-20 text-center">
          <Building2 className="w-12 h-12 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 font-medium">No companies found</p>
          <p className="text-surface-600 text-sm mt-1">
            {search ? "Try a different search" : "Create your first company to get started"}
          </p>
          {!search && (
            <Link href="/platform/companies/new">
              <Button className="mt-4">
                <Plus className="w-4 h-4" /> Create Company
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((company) => (
            <div
              key={company.id}
              className="bg-surface-800 border border-surface-700 rounded-2xl p-5 hover:border-surface-600 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-white text-lg flex-shrink-0">
                    {company.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-surface-100 text-base">{company.name}</h3>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          company.isActive
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-surface-700 text-surface-400"
                        }`}
                      >
                        {company.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-surface-400 mt-0.5">{company.slug}.domain.com</p>
                    {/* Role levels */}
                    {company.roleLevels.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {company.roleLevels.map((rl) => (
                          <span
                            key={rl.id}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                            style={{ color: rl.color, borderColor: rl.color + "40", backgroundColor: rl.color + "15" }}
                          >
                            {rl.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats + Menu */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="hidden sm:flex items-center gap-4 text-xs text-surface-400">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {company._count.users} users
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5" />
                      {company._count.tasks} tasks
                    </span>
                  </div>

                  {/* Action menu */}
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === company.id ? null : company.id)}
                      className="p-2 text-surface-400 hover:text-surface-200 hover:bg-surface-700 rounded-lg transition-all"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {menuOpen === company.id && (
                      <div className="absolute right-0 top-full mt-1 w-52 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                        <Link
                          href={`/platform/companies/${company.id}`}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-all"
                          onClick={() => setMenuOpen(null)}
                        >
                          <Eye className="w-4 h-4" /> View / Edit
                        </Link>
                        <Link
                          href={`/t/${company.slug}/dashboard`}
                          target="_blank"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-all"
                          onClick={() => setMenuOpen(null)}
                        >
                          <ArrowRight className="w-4 h-4" /> Open Tenant
                        </Link>
                        <button
                          onClick={() => handleRegenerateCreds(company.id)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-all"
                        >
                          <RefreshCw className="w-4 h-4" /> Regen Credentials
                        </button>
                        <button
                          onClick={() => handleToggleActive(company.id, company.isActive)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-all"
                        >
                          {company.isActive ? (
                            <><EyeOff className="w-4 h-4" /> Deactivate</>
                          ) : (
                            <><Eye className="w-4 h-4" /> Activate</>
                          )}
                        </button>
                        <div className="border-t border-surface-700 my-1" />
                        <button
                          onClick={() => { setConfirmDelete(company.id); setMenuOpen(null); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Company
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credentials Modal */}
      {credModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCredModal(null)} />
          <div className="relative bg-surface-800 border border-surface-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-surface-100 mb-1">New Credentials Generated</h3>
            <p className="text-sm text-surface-400 mb-4">
              Share these with the super admin. The password won&apos;t be shown again.
            </p>
            <div className="space-y-3">
              {[
                {
                  label: "Login URL",
                  value: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/t/${credModal.slug}/login`,
                },
                { label: "Email", value: credModal.email },
                { label: "Password", value: credModal.password },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-surface-400 mb-1">{label}</p>
                  <div className="flex items-center gap-2 bg-surface-900 rounded-lg px-3 py-2">
                    <code className="text-sm text-emerald-400 flex-1 break-all">{value}</code>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyToClipboard(value);
                        if (ok) toast.success("Copied!");
                        else toast.error("Could not copy — select the text manually");
                      }}
                      className="text-surface-400 hover:text-surface-100 flex-shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={() => setCredModal(null)} variant="secondary" className="w-full mt-5">
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Delete Company?"
        description="This will permanently delete the company and all its data. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Mobile FAB */}
      <div className="fixed bottom-6 right-4 sm:hidden z-10">
        <Link href="/platform/companies/new">
          <button className="w-14 h-14 bg-gradient-to-br from-primary-600 to-primary-500 text-white rounded-full shadow-xl shadow-primary-500/40 flex items-center justify-center">
            <Plus className="w-6 h-6" />
          </button>
        </Link>
      </div>
    </div>
  );
}
