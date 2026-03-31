"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function SignupSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [slug, setSlug] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setMessage("Missing payment session. Return to signup and try again, or log in if you already have an account.");
      return;
    }

    let cancelled = false;
    let attempt = 0;
    const maxNotReadyRetries = 25;

    const run = async () => {
      try {
        const res = await fetch("/api/public/checkout/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json()) as { ok?: boolean; slug?: string; error?: string };

        if (cancelled) return;

        if (res.ok && data.ok && data.slug) {
          setSlug(data.slug);
          setStatus("ready");
          return;
        }

        if (res.status === 409 && attempt < maxNotReadyRetries) {
          attempt += 1;
          setTimeout(() => {
            if (!cancelled) void run();
          }, 2000);
          return;
        }

        setStatus("error");
        setMessage(data.error || "Could not finish workspace setup.");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Network error. Check your connection and try refreshing this page.");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center p-6 text-center">
      {status === "loading" && (
        <>
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin mb-4" />
          <h1 className="text-2xl font-bold text-surface-50">Setting up your workspace</h1>
          <p className="text-surface-500 mt-3 max-w-md">
            Finishing your account from your payment session. This usually takes a few seconds.
          </p>
        </>
      )}

      {status === "ready" && slug && (
        <>
          <h1 className="text-2xl font-bold text-surface-50">You are all set</h1>
          <p className="text-surface-500 mt-3 max-w-md">
            Your workspace is ready. Log in with the email and password you used at signup.
          </p>
          <Link
            href={`/t/${encodeURIComponent(slug)}/login`}
            className="mt-8 inline-flex items-center rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-6 py-3"
          >
            Go to your workspace
          </Link>
          <Link href="/login" className="mt-4 text-sm text-primary-400 hover:text-primary-300">
            Central login
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-2xl font-bold text-surface-50">Could not finish setup</h1>
          <p className="text-surface-500 mt-3 max-w-md">{message}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold px-6 py-3"
            >
              Retry
            </button>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl border border-surface-700 text-surface-200 font-semibold px-6 py-3 hover:bg-surface-900"
            >
              Back to signup
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function SignupSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-950 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
        </div>
      }
    >
      <SignupSuccessContent />
    </Suspense>
  );
}
