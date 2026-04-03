"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  GitBranch,
  UserCheck,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Settings,
  RotateCcw,
  Bell,
  Calendar,
  UserCircle,
  Lightbulb,
  CreditCard,
  ClipboardList,
  PenLine,
  PanelLeftClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import { TenantTokenPayload } from "@/lib/auth";
import toast from "react-hot-toast";
import BillingStatusBanner from "@/components/tenant/BillingStatusBanner";
import LeaderQaBubble from "@/components/tenant/LeaderQaBubble";

export type TenantLayoutUser = TenantTokenPayload & { avatarUrl?: string | null };

function CompanyMark({
  size,
  companyName,
  companyLogoUrl,
}: {
  size: "sm" | "md";
  companyName: string;
  companyLogoUrl?: string | null;
}) {
  const isSm = size === "sm";
  const box = isSm ? "w-7 h-7 rounded-lg" : "w-9 h-9 rounded-xl";
  if (companyLogoUrl) {
    return (
      <img
        src={companyLogoUrl}
        alt=""
        className={
          box +
          " object-cover flex-shrink-0 shadow-lg shadow-primary-900/40 ring-1 ring-primary-400/30 bg-surface-800"
        }
      />
    );
  }
  return (
    <div
      className={
        box +
        " flex items-center justify-center font-bold text-white bg-gradient-to-br from-primary-500 to-primary-700 flex-shrink-0 shadow-lg shadow-primary-900/40 ring-1 ring-primary-400/30 " +
        (isSm ? "text-xs" : "text-sm")
      }
    >
      {companyName.charAt(0).toUpperCase()}
    </div>
  );
}

interface TenantLayoutProps {
  children: React.ReactNode;
  user: TenantLayoutUser;
  companyName: string;
  companyLogoUrl?: string | null;
  slug: string;
  modules: string[];
  pendingApprovals?: number;
}

export default function TenantLayout({
  children,
  user,
  companyName,
  companyLogoUrl,
  slug,
  modules,
  pendingApprovals = 0,
}: TenantLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navPremium, setNavPremium] = useState<{ chat: boolean; recurring: boolean; content: boolean } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const sidebarCollapseKey = `tenant-sidebar-collapsed-${slug}`;
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(sidebarCollapseKey) === "1") {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, [sidebarCollapseKey]);

  useEffect(() => {
    try {
      localStorage.setItem(sidebarCollapseKey, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed, sidebarCollapseKey]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/t/${encodeURIComponent(slug)}/billing/entitlements`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.showChatNav === "boolean") {
          setNavPremium({
            chat: d.showChatNav,
            recurring: d.showRecurringNav,
            content: Boolean(d.showContentStudioNav),
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleLogout = async () => {
    await fetch(`/api/t/${slug}/logout`, { method: "POST" });
    toast.success("Logged out");
    router.push(`/t/${slug}/login`);
  };

  const companyChatOk = navPremium === null ? modules.includes("chat") : navPremium.chat;
  const companyRecOk = navPremium === null ? modules.includes("recurring") : navPremium.recurring;
  const companyContentOk = navPremium === null ? modules.includes("content") : navPremium.content;
  const chatNav = companyChatOk && Boolean(user.chatAddonAccess);
  const recurringNav = companyRecOk && Boolean(user.recurringAddonAccess);
  const contentStudioNav = companyContentOk && Boolean(user.contentStudioAddonAccess);

  const navItems = [
    { href: `/t/${slug}/dashboard`, label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: `/t/${slug}/tasks`, label: "Tasks", icon: CheckSquare, show: modules.includes("tasks") },
    {
      href: `/t/${slug}/tasks/requests`,
      label: "Task requests",
      icon: ClipboardList,
      show: modules.includes("tasks"),
    },
    { href: `/t/${slug}/team`, label: "Team", icon: Users, show: modules.includes("team") },
    { href: `/t/${slug}/org`, label: "Org Chart", icon: GitBranch, show: modules.includes("org") },
    { href: `/t/${slug}/chat`, label: "Team Chat", icon: Bell, show: chatNav },
    { href: `/t/${slug}/calendar`, label: "Calendar", icon: Calendar, show: modules.includes("tasks") },
    {
      href: `/t/${slug}/content`,
      label: "Content",
      icon: PenLine,
      show: contentStudioNav,
    },
    { href: `/t/${slug}/recurring`, label: "Recurring", icon: RotateCcw, show: recurringNav },
    { href: `/t/${slug}/ideas`, label: "Idea Board", icon: Lightbulb, show: true },
    {
      href: `/t/${slug}/approvals`,
      label: "Approvals",
      icon: UserCheck,
      show: modules.includes("approvals"),
      badge: pendingApprovals > 0 ? pendingApprovals : undefined,
    },
    ...(user.isSuperAdmin
      ? [{ href: `/t/${slug}/settings`, label: "Settings", icon: Settings, show: true }]
      : []),
  ].filter((item) => item.show);

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === `/t/${slug}/tasks/requests`) return pathname.startsWith(`/t/${slug}/tasks/requests`);
    if (href === `/t/${slug}/tasks`) {
      return pathname.startsWith(`${href}/`) && !pathname.startsWith(`/t/${slug}/tasks/requests`);
    }
    return pathname.startsWith(`${href}/`) && href !== `/t/${slug}/dashboard`;
  };

  const SidebarContent = ({ collapsed, desktop }: { collapsed: boolean; desktop: boolean }) => (
    <div className="flex flex-col h-full min-h-0">
      {/* Company branding + collapse (desktop only) */}
      <div
        className={cn(
          "border-b border-surface-200/90 dark:border-surface-800/80 shrink-0",
          collapsed && desktop ? "px-2 py-3 flex flex-col items-center gap-2" : "px-5 py-4"
        )}
      >
        <div className={cn("flex items-center gap-3 w-full", collapsed && desktop && "flex-col justify-center")}>
          <CompanyMark size="md" companyName={companyName} companyLogoUrl={companyLogoUrl} />
          {!(collapsed && desktop) && (
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-slate-900 dark:text-surface-50 text-sm truncate tracking-tight">{companyName}</p>
              <p className="text-[10px] text-slate-600 dark:text-surface-500 font-semibold uppercase tracking-widest">{slug}</p>
            </div>
          )}
          {desktop && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className={cn(
                "p-2 rounded-lg text-slate-500 hover:bg-surface-200/90 hover:text-slate-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-100 transition-colors shrink-0",
                collapsed && "mx-auto"
              )}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-4 space-y-0.5 overflow-y-auto min-h-0", collapsed && desktop ? "px-1.5" : "px-3")}>
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed && desktop ? label : undefined}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "group flex items-center rounded-xl text-sm font-medium transition-all duration-150 relative",
                collapsed && desktop ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                active
                  ? "bg-primary-100 text-primary-900 border border-primary-200/90 shadow-sm dark:bg-primary-500/20 dark:text-primary-200 dark:border-primary-500/30 dark:shadow-sm dark:shadow-primary-900/20"
                  : "text-slate-700 hover:text-slate-900 hover:bg-surface-200/90 dark:text-surface-400 dark:hover:text-surface-100 dark:hover:bg-surface-800/80"
              )}
            >
              <span className="relative inline-flex">
                <Icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0 transition-colors",
                    active
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-slate-600 group-hover:text-slate-900 dark:text-surface-500 dark:group-hover:text-surface-300"
                  )}
                />
                {collapsed && desktop && badge !== undefined && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {!(collapsed && desktop) && (
                <>
                  <span className="flex-1">{label}</span>
                  {badge !== undefined && (
                    <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow shadow-red-900/40">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                  {active && <ChevronRight className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className={cn("py-3 border-t border-surface-200/90 dark:border-surface-800/80 space-y-0.5 shrink-0", collapsed && desktop ? "px-1.5" : "px-3")}>
        <Link
          href={`/t/${slug}/profile`}
          title={collapsed && desktop ? "My Profile" : undefined}
          onClick={() => setSidebarOpen(false)}
          className={cn(
            "group flex items-center rounded-xl text-sm font-medium transition-all duration-150",
            collapsed && desktop ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
            isActive(`/t/${slug}/profile`)
              ? "bg-primary-100 text-primary-900 border border-primary-200/90 dark:bg-primary-500/20 dark:text-primary-200 dark:border-primary-500/30"
              : "text-slate-700 hover:text-slate-900 hover:bg-surface-200/90 dark:text-surface-400 dark:hover:text-surface-100 dark:hover:bg-surface-800/80"
          )}
        >
          <UserCircle className="w-4 h-4 flex-shrink-0 text-slate-600 group-hover:text-slate-900 dark:text-surface-500 dark:group-hover:text-surface-300" />
          {!(collapsed && desktop) && <span className="flex-1">My Profile</span>}
        </Link>
        {user.isSuperAdmin && (
          <Link
            href={`/t/${slug}/billing`}
            title={collapsed && desktop ? "Billing & Usage" : undefined}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "group flex items-center rounded-xl text-sm font-medium transition-all duration-150",
              collapsed && desktop ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
              isActive(`/t/${slug}/billing`)
                ? "bg-primary-100 text-primary-900 border border-primary-200/90 dark:bg-primary-500/20 dark:text-primary-200 dark:border-primary-500/30"
                : "text-slate-700 hover:text-slate-900 hover:bg-surface-200/90 dark:text-surface-400 dark:hover:text-surface-100 dark:hover:bg-surface-800/80"
            )}
          >
            <CreditCard className="w-4 h-4 flex-shrink-0 text-slate-600 group-hover:text-slate-900 dark:text-surface-500 dark:group-hover:text-surface-300" />
            {!(collapsed && desktop) && <span className="flex-1">Billing & Usage</span>}
          </Link>
        )}
        <div
          className={cn(
            "flex items-center rounded-xl py-2",
            collapsed && desktop ? "flex-col gap-2 px-1" : "gap-3 px-3"
          )}
        >
          <Avatar
            firstName={user.firstName}
            lastName={user.lastName}
            email={user.email}
            avatarUrl={user.avatarUrl ?? undefined}
            size="sm"
          />
          {!(collapsed && desktop) && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-surface-200 truncate tracking-tight">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] text-slate-600 dark:text-surface-400 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-slate-700 hover:text-red-600 dark:text-surface-500 dark:hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 flex-shrink-0"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-surface-900/95 border-r border-surface-200/90 dark:border-surface-800/70 flex-shrink-0 backdrop-blur-xl transition-[width] duration-200 ease-out overflow-hidden",
          sidebarCollapsed ? "w-[4.5rem]" : "w-60"
        )}
      >
        <SidebarContent collapsed={sidebarCollapsed} desktop />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-surface-900 border-r border-surface-200 dark:border-surface-800/70 flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-surface-200/90 dark:border-surface-800/80 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CompanyMark size="sm" companyName={companyName} companyLogoUrl={companyLogoUrl} />
                <span className="font-extrabold text-slate-900 dark:text-surface-50 text-sm tracking-tight truncate">{companyName}</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-surface-400 hover:text-surface-100 p-1 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent collapsed={false} desktop={false} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-surface-900/95 border-b border-surface-200/90 dark:border-surface-800/70 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-700 hover:text-slate-900 dark:text-surface-400 dark:hover:text-surface-100 p-1 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CompanyMark size="sm" companyName={companyName} companyLogoUrl={companyLogoUrl} />
            <span className="font-extrabold text-slate-900 dark:text-surface-50 text-sm truncate tracking-tight">{companyName}</span>
          </div>
          {pendingApprovals > 0 && (
            <Link href={`/t/${slug}/approvals`} className="relative">
              <Bell className="w-5 h-5 text-surface-400" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {pendingApprovals}
              </span>
            </Link>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <BillingStatusBanner slug={slug} />
          <div className="flex-1 min-h-0">{children}</div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden flex items-center bg-surface-900/95 border-t border-surface-200/90 dark:border-surface-800/70 px-2 py-1 backdrop-blur-xl z-30">
          {navItems.slice(0, 5).map(({ href, label, icon: Icon, badge }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all",
                  active ? "text-primary-700 dark:text-primary-300" : "text-slate-700 hover:text-slate-900 dark:hover:text-surface-300"
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badge !== undefined && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold tracking-tight text-slate-800 dark:text-inherit">{label}</span>
              </Link>
            );
          })}
        </nav>

        {chatNav && <LeaderQaBubble slug={slug} openWithLeaderGpt={false} />}
      </div>
    </div>
  );
}
