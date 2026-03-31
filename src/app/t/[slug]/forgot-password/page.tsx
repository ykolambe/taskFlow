"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";

export default function TenantForgotPasswordPage() {
  const params = useParams();
  const slug = params.slug as string;
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

  const displayName = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Workspace";

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <h1 className="text-xl font-extrabold text-surface-50 capitalize">{displayName}</h1>
          <p className="text-surface-500 text-sm mt-1">Forgot password</p>
        </div>
        <div className="bg-surface-900/80 border border-surface-700/60 rounded-2xl p-7">
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
              If an account exists, we sent reset links. Check your email.
            </p>
          )}
          <Link
            href={`/t/${slug}/login`}
            className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-300 mt-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
