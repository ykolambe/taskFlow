"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";

function ResetPasswordForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid link");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/t/${slug}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not reset password");
        return;
      }
      toast.success("Password updated");
      window.location.href = `/t/${slug}/login`;
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <p className="text-surface-400 text-sm text-center">
        This link is invalid. Request a new reset from the login page.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        leftIcon={<Lock className="w-4 h-4" />}
        placeholder="At least 8 characters"
      />
      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        leftIcon={<Lock className="w-4 h-4" />}
      />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}

export default function TenantResetPasswordPage() {
  const params = useParams();
  const slug = params.slug as string;
  const displayName = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Workspace";

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <h1 className="text-xl font-extrabold text-surface-50 capitalize">{displayName}</h1>
          <p className="text-surface-500 text-sm mt-1">Set a new password</p>
        </div>
        <div className="bg-surface-900/80 border border-surface-700/60 rounded-2xl p-7">
          <Suspense fallback={<p className="text-surface-500 text-sm">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
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
