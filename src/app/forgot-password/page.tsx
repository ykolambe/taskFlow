"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Zap } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Could not send email");
        return;
      }
      setSent(true);
      toast.success("Check your inbox");
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
      </div>
      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-8 space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-700 rounded-2xl shadow-2xl shadow-primary-900/60 ring-1 ring-primary-400/30">
            <Zap className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-surface-50 tracking-tight">Forgot password</h1>
            <p className="text-surface-500 text-sm mt-1">
              {sent
                ? "If an account exists for that email, we sent reset links for each workspace."
                : "We will email you reset links for every workspace this address belongs to."}
            </p>
          </div>
        </div>

        <div className="relative bg-surface-900/80 border border-surface-700/60 rounded-2xl p-7 shadow-2xl">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                placeholder="you@company.com"
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset links"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-surface-400 text-center">
              You can close this tab. Links expire in one hour.
            </p>
          )}
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-300 mt-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to log in
          </Link>
        </div>
      </div>
    </div>
  );
}
