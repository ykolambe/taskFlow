"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface PlatformLayoutProps {
  children: React.ReactNode;
  user: { name: string; email: string };
}

const navItems = [
  { href: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/companies", label: "Companies",  icon: Building2    },
  { href: "/platform/billing",   label: "Billing",    icon: CreditCard   },
];

export default function PlatformLayout({ children, user }: PlatformLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/platform/logout", { method: "POST" });
    toast.success("Logged out");
    router.push("/platform/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-900/40 ring-1 ring-primary-400/30 flex-shrink-0">
            <Zap className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-extrabold text-surface-50 text-sm tracking-tight">TaskFlow</p>
            <p className="text-[10px] text-surface-500 font-semibold uppercase tracking-widest">Platform Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-primary-500/20 text-primary-200 border border-primary-500/30 shadow-sm shadow-primary-900/20"
                  : "text-surface-400 hover:text-surface-100 hover:bg-surface-800/80"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  active ? "text-primary-300" : "text-surface-500 group-hover:text-surface-300"
                )}
              />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 text-primary-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-3 border-t border-surface-800/80">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-800/60">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow shadow-primary-900/40 ring-1 ring-primary-400/20">
            <span className="text-xs font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-surface-200 truncate tracking-tight">{user.name}</p>
            <p className="text-[10px] text-surface-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-surface-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 flex-shrink-0"
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
      <aside className="hidden lg:flex w-60 flex-col bg-surface-900/95 border-r border-surface-800/70 flex-shrink-0 backdrop-blur-xl">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-surface-900 border-r border-surface-800/70 flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-surface-800/80">
              <span className="font-extrabold text-surface-50 text-sm tracking-tight">Menu</span>
              <button onClick={() => setSidebarOpen(false)} className="text-surface-400 hover:text-surface-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-surface-900/95 border-b border-surface-800/70 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-surface-400 hover:text-surface-100 p-1 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-primary-400 to-primary-700 rounded-lg flex items-center justify-center shadow shadow-primary-900/40 ring-1 ring-primary-400/30">
              <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-surface-50 text-sm tracking-tight">TaskFlow</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
