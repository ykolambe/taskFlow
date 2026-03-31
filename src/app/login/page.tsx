"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Mail, Zap } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";

type Workspace = { slug: string; name: string; companyId: string };

export default function PublicLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);

  const submitTenantLogin = async (slug: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/t/${slug}/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }
      toast.success("Welcome back!");
      router.push(`/t/${slug}/dashboard`);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    setWorkspaces(null);
    try {
      const res = await fetch("/api/public/tenant-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }
      if (data.workspaces?.length) {
        setWorkspaces(data.workspaces);
        toast.success("Choose a workspace to continue");
        return;
      }
      if (data.redirectTo) {
        toast.success("Welcome back!");
        router.push(data.redirectTo);
        router.refresh();
        return;
      }
      toast.error("Unexpected response");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent-500/8 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(9,13,23,0.6)_100%)]" />
      </div>
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-8 space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-700 rounded-2xl shadow-2xl shadow-primary-900/60 ring-1 ring-primary-400/30">
            <Zap className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-surface-50 tracking-tight">Log in</h1>
            <p className="text-surface-500 text-sm mt-1">Use your work email for any workspace</p>
          </div>
        </div>

        <div className="relative bg-surface-900/80 border border-surface-700/60 rounded-2xl p-7 shadow-2xl shadow-black/50 backdrop-blur-xl ring-1 ring-inset ring-white/[0.04]">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent rounded-t-2xl" />

          {!workspaces?.length ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    placeholder="you@company.com"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Password</label>
                  <Link href="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-surface-400 mb-4">Select a workspace:</p>
              <ul className="space-y-2">
                {workspaces.map((w) => (
                  <li key={w.companyId}>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => submitTenantLogin(w.slug)}
                      className="w-full text-left rounded-xl border border-surface-700 bg-surface-800/50 hover:bg-surface-800 px-4 py-3 transition-colors"
                    >
                      <span className="font-semibold text-surface-100">{w.name}</span>
                      <span className="block text-xs text-surface-500 mt-0.5">/{w.slug}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setWorkspaces(null)}
                className="text-sm text-surface-500 hover:text-surface-300 mt-2"
              >
                ← Back
              </button>
            </div>
          )}

          <p className="text-center text-sm text-surface-500 mt-6">
            New here?{" "}
            <Link href="/signup" className="text-primary-400 hover:text-primary-300 font-medium">
              Create a workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
