import { redirect } from "next/navigation";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlatformLayout from "@/components/layout/PlatformLayout";
import { StatCard } from "@/components/ui/Card";
import { Building2, Users, CheckSquare, TrendingUp, Plus, ArrowRight, Activity, CreditCard } from "lucide-react";
import Link from "next/link";
import { formatDate, formatRelative } from "@/lib/utils";

export default async function PlatformDashboardPage() {
  const user = await getPlatformUser();
  if (!user) redirect("/platform/login");

  const [totalCompanies, activeCompanies, totalUsers, totalTasks, recentCompanies] =
    await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.task.count(),
      prisma.company.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { users: true, tasks: true } } },
      }),
    ]);

  return (
    <PlatformLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-1">Platform Admin</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-surface-50">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="text-surface-500 text-sm mt-1">
              Here&apos;s your platform overview
            </p>
          </div>
          <Link href="/platform/companies/new">
            <button className="hidden sm:flex items-center gap-2 bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary-900/40 border border-primary-400/30">
              <Plus className="w-4 h-4" />
              New Company
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Companies"
            value={totalCompanies}
            subtitle={`${activeCompanies} active`}
            icon={<Building2 className="w-5 h-5" />}
            color="primary"
          />
          <StatCard
            title="Active Companies"
            value={activeCompanies}
            subtitle="Running tenants"
            icon={<Activity className="w-5 h-5" />}
            color="success"
          />
          <StatCard
            title="Total Users"
            value={totalUsers}
            subtitle="Across all companies"
            icon={<Users className="w-5 h-5" />}
            color="info"
          />
          <StatCard
            title="Total Tasks"
            value={totalTasks}
            subtitle="All time created"
            icon={<CheckSquare className="w-5 h-5" />}
            color="warning"
          />
        </div>

        {/* Quick link: Billing lives under /platform (platform owner), not tenant /t/... */}
        <Link
          href="/platform/billing"
          className="flex items-center justify-between gap-4 mb-8 p-5 rounded-2xl border border-primary-500/25 bg-gradient-to-r from-primary-500/10 via-surface-900/80 to-surface-900/80 hover:border-primary-500/40 transition-all group"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-primary-300" />
            </div>
            <div>
              <p className="font-bold text-surface-100">Billing & usage</p>
              <p className="text-sm text-surface-500 mt-0.5">
                Default per-seat pricing, company overrides, and estimated MRR
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-surface-600 group-hover:text-primary-400 transition-colors flex-shrink-0" />
        </Link>

        {/* Recent Companies */}
        <div className="bg-surface-900/80 border border-surface-700/60 rounded-2xl overflow-hidden shadow-lg shadow-black/20 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60">
            <h2 className="font-bold tracking-tight text-surface-50">Recent Companies</h2>
            <Link
              href="/platform/companies"
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentCompanies.length === 0 ? (
            <div className="py-16 text-center">
              <Building2 className="w-10 h-10 text-surface-600 mx-auto mb-3" />
              <p className="text-surface-400 font-medium">No companies yet</p>
              <p className="text-surface-600 text-sm mt-1">Create your first company to get started</p>
              <Link href="/platform/companies/new" className="inline-flex items-center gap-2 mt-4 bg-primary-500/20 text-primary-400 px-4 py-2 rounded-xl text-sm border border-primary-500/30 hover:bg-primary-500/30 transition-all">
                <Plus className="w-4 h-4" /> Create Company
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-surface-800/70">
              {recentCompanies.map((company) => (
                <Link
                  key={company.id}
                  href={`/platform/companies/${company.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-surface-800/60 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center font-extrabold text-white text-sm flex-shrink-0 shadow shadow-primary-900/40 ring-1 ring-primary-400/20">
                      {company.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold tracking-tight text-surface-200 group-hover:text-surface-50 transition-colors">
                        {company.name}
                      </p>
                      <p className="text-xs text-surface-600">
                        {company.slug}.domain.com · {formatRelative(company.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:flex items-center gap-4 text-xs text-surface-600">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {company._count.users}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5" /> {company._count.tasks}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide ${
                        company.isActive
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                          : "bg-surface-800 text-surface-500 border border-surface-700"
                      }`}
                    >
                      {company.isActive ? "Active" : "Inactive"}
                    </span>
                    <ArrowRight className="w-4 h-4 text-surface-700 group-hover:text-surface-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Mobile FAB */}
        <div className="fixed bottom-6 right-4 sm:hidden z-10">
          <Link href="/platform/companies/new">
            <button className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-2xl shadow-xl shadow-primary-900/60 flex items-center justify-center ring-1 ring-primary-400/30">
              <Plus className="w-6 h-6" />
            </button>
          </Link>
        </div>
      </div>
    </PlatformLayout>
  );
}
