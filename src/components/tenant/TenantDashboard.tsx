"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Users,
  Clock,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Crown,
  Flame,
  Target,
  Lock,
} from "lucide-react";
import { StatCard } from "@/components/ui/Card";
import { TenantTokenPayload } from "@/lib/auth";
import { Task } from "@/types";
import { isExecutiveDashboardUser } from "@/lib/utils";
import DashboardReminders, { type ReminderRow } from "@/components/tenant/DashboardReminders";
import DashboardCharts, { type PriorityCount } from "@/components/tenant/DashboardCharts";
import DashboardRecentTasks from "@/components/tenant/DashboardRecentTasks";
import DashboardTaskRow from "@/components/tenant/DashboardTaskRow";
import ExecutiveBriefCard from "@/components/tenant/ExecutiveBriefCard";
interface Props {
  user: TenantTokenPayload;
  stats: { myTasks: number; teamTasks: number; pendingApprovals: number; overdueTasks: number };
  recentTasks: Task[];
  recentTasksPageSize: number;
  recentTasksHasMore: boolean;
  chartData: { myByPriority: PriorityCount[]; teamByPriority: PriorityCount[] };
  reviewTasks: Task[];
  slug: string;
  reminders: ReminderRow[];
  remindersHasMore: boolean;
  aiEnabled: boolean;
  leaderQaEnabled: boolean;
  /** AI + LeaderGPT: quick link opens chat with ?ai=1. */
  leaderGptMergedInTeamChat?: boolean;
  executiveInsights: {
    directReports: number;
    teamSize: number;
    highPriorityOpen: number;
  } | null;
}

export default function TenantDashboard({
  user,
  stats,
  recentTasks,
  recentTasksPageSize,
  recentTasksHasMore,
  chartData,
  reviewTasks,
  slug,
  reminders,
  remindersHasMore,
  aiEnabled,
  leaderQaEnabled,
  leaderGptMergedInTeamChat = false,
  executiveInsights,
}: Props) {
  // Trigger auto-generation of due recurring tasks silently on every dashboard visit
  useEffect(() => {
    fetch(`/api/t/${slug}/recurring/generate`, { method: "POST" }).catch(() => {});
  }, [slug]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-surface-100">
          Good day, {user.firstName} 👋
        </h1>
        <p className="text-slate-600 dark:text-surface-400 text-sm mt-1">
          {isExecutiveDashboardUser(user)
            ? "Leadership overview — team load, follow-ups, and what needs your attention."
            : "Here's your workspace overview"}
        </p>
      </div>

      {isExecutiveDashboardUser(user) &&
        (aiEnabled ? (
          <ExecutiveBriefCard slug={slug} />
        ) : (
          <div className="rounded-2xl border border-surface-700 bg-surface-800/80 p-4">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-surface-100">Executive AI Brief is locked</p>
                <p className="text-xs text-surface-500 mt-1">
                  Your company does not have the AI add-on enabled. Ask your platform admin to enable AI in company billing.
                </p>
              </div>
            </div>
          </div>
        ))}

      {/* Leadership snapshot — directors / C-suite / top levels */}
      {executiveInsights && (
        <div className="bg-gradient-to-br from-violet-500/15 via-surface-100 to-surface-200/50 dark:from-violet-500/10 dark:via-surface-800 dark:to-surface-800 border border-violet-200/80 dark:border-violet-500/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h2 className="font-semibold text-slate-900 dark:text-surface-100 text-sm tracking-tight">Leadership snapshot</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href={`/t/${slug}/team`}
              className="rounded-xl bg-white/95 dark:bg-surface-900/60 border border-slate-200/90 dark:border-surface-700/80 p-4 hover:border-violet-400/60 dark:hover:border-violet-500/30 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2 text-violet-900 dark:text-violet-300 text-xs font-semibold uppercase tracking-wider mb-1">
                <Users className="w-3.5 h-3.5 text-violet-700 dark:text-violet-400" />
                Direct reports
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-surface-50">{executiveInsights.directReports}</p>
              <p className="text-[11px] text-slate-600 dark:text-surface-500 mt-1">People reporting to you</p>
            </Link>
            <div className="rounded-xl bg-white/95 dark:bg-surface-900/60 border border-slate-200/90 dark:border-surface-700/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sky-900 dark:text-sky-300 text-xs font-semibold uppercase tracking-wider mb-1">
                <Target className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                Team in view
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-surface-50">{executiveInsights.teamSize}</p>
              <p className="text-[11px] text-slate-600 dark:text-surface-500 mt-1">You + everyone below in the org tree</p>
            </div>
            <Link
              href={`/t/${slug}/tasks`}
              className="rounded-xl bg-white/95 dark:bg-surface-900/60 border border-slate-200/90 dark:border-surface-700/80 p-4 hover:border-amber-400/60 dark:hover:border-amber-500/30 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">
                <Flame className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                High / urgent open
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-surface-50">{executiveInsights.highPriorityOpen}</p>
              <p className="text-[11px] text-slate-600 dark:text-surface-500 mt-1">Across your visible team (active work)</p>
            </Link>
          </div>
        </div>
      )}

      <DashboardReminders slug={slug} initial={reminders} initialHasMore={remindersHasMore} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="My Tasks"
          value={stats.myTasks}
          subtitle="Active tasks"
          icon={<CheckSquare className="w-5 h-5" />}
          color="primary"
        />
        <StatCard
          title="Team Tasks"
          value={stats.teamTasks}
          subtitle="Below me"
          icon={<Users className="w-5 h-5" />}
          color="info"
        />
        <StatCard
          title="Overdue"
          value={stats.overdueTasks}
          subtitle="Need attention"
          icon={<AlertCircle className="w-5 h-5" />}
          color="danger"
        />
        {stats.pendingApprovals > 0 && (
          <StatCard
            title="Approvals"
            value={stats.pendingApprovals}
            subtitle="Pending review"
            icon={<UserCheck className="w-5 h-5" />}
            color="warning"
          />
        )}
      </div>

      <DashboardCharts myByPriority={chartData.myByPriority} teamByPriority={chartData.teamByPriority} />

      {/* Needs Review */}
      {reviewTasks.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="font-semibold text-amber-400 text-sm">Ready for Your Review</h2>
            </div>
            <Link href={`/t/${slug}/tasks?status=READY_FOR_REVIEW`} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-amber-500/10">
            {reviewTasks.map((task) => (
              <DashboardTaskRow key={task.id} task={task} slug={slug} currentUserLevel={user.level} />
            ))}
          </div>
        </div>
      )}

      <DashboardRecentTasks
        slug={slug}
        user={user}
        initialTasks={recentTasks}
        pageSize={recentTasksPageSize}
        initialHasMore={recentTasksHasMore}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ...(leaderGptMergedInTeamChat
            ? [
                {
                  href: `/t/${slug}/chat?ai=1`,
                  icon: "✨",
                  label: "LeaderGPT",
                  color:
                    "from-fuchsia-500/20 to-purple-600/10 border-fuchsia-500/35 hover:border-fuchsia-500/55",
                },
              ]
            : []),
          { href: `/t/${slug}/tasks?new=1`, icon: "✅", label: "New Task", color: "from-primary-500/20 to-primary-600/10 border-primary-500/30 hover:border-primary-500/50" },
          { href: `/t/${slug}/calendar`, icon: "📅", label: "Calendar", color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-500/50" },
          { href: `/t/${slug}/recurring`, icon: "🔁", label: "Recurring", color: "from-violet-500/20 to-violet-600/10 border-violet-500/30 hover:border-violet-500/50" },
          { href: `/t/${slug}/org`, icon: "🌳", label: "Org Chart", color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-500/50" },
        ].map(({ href, icon, label, color }) => (
          <Link key={href} href={href}>
            <div className={`bg-gradient-to-br ${color} border rounded-xl p-4 text-center hover:scale-[1.02] transition-all`}>
              <div className="text-2xl mb-2">{icon}</div>
              <p className="text-sm font-medium text-surface-200">{label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
