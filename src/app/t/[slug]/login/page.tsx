"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Lock, Eye, EyeOff, User } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";

export default function TenantLoginPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/t/${slug}/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }
      toast.success(`Welcome back, ${data.firstName}!`);
      router.push(`/t/${slug}/dashboard`);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const initial = slug ? slug.charAt(0).toUpperCase() : "T";
  const displayName = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Workspace";

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-primary-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/3 w-[350px] h-[350px] bg-accent-500/8 rounded-full blur-[100px]" />
      </div>

      {/* Grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="w-full max-w-[400px] relative z-10">
        {/* Brand mark */}
        <div className="text-center mb-8 space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-700 rounded-2xl shadow-2xl shadow-primary-900/60 ring-1 ring-primary-400/30 text-white font-extrabold text-2xl">
            {initial}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-surface-50 tracking-tight capitalize">{displayName}</h1>
            <p className="text-surface-500 text-xs mt-0.5 font-medium uppercase tracking-widest">Workspace</p>
          </div>
        </div>

        {/* Card */}
        <div className="relative bg-surface-900/80 border border-surface-700/60 rounded-2xl p-7 shadow-2xl shadow-black/50 backdrop-blur-xl ring-1 ring-inset ring-white/[0.04]">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent rounded-t-2xl" />

          <div className="mb-6">
            <h2 className="text-lg font-bold tracking-tight text-surface-50">Welcome back</h2>
            <p className="text-surface-500 text-sm mt-0.5">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email or Username"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@company.com"
              leftIcon={<User className="w-4 h-4" />}
              autoComplete="username"
              required
            />

            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-surface-500 hover:text-surface-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              autoComplete="current-password"
              required
            />

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Sign In →
            </Button>
          </form>
        </div>

        <p className="text-center text-surface-700 text-xs mt-6 tracking-wide">
          Powered by TaskFlow Platform
        </p>
      </div>
    </div>
  );
}
