"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";

type Entitlements = {
  plan: string;
  paidSubscriptionActive: boolean;
  showExpiredBanner: boolean;
  showFreeUpgradeCta: boolean;
  isSuperAdmin: boolean;
  seatsUsed: number;
  seatsLimit: number | null;
};

export default function BillingStatusBanner({ slug }: { slug: string }) {
  const [data, setData] = useState<Entitlements | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/t/${encodeURIComponent(slug)}/billing/entitlements`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!data) return null;

  const isAdmin = data.isSuperAdmin;

  if (data.showExpiredBanner) {
    return (
      <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2 text-sm text-amber-950 dark:text-amber-100">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p>
              <span className="font-semibold">Subscription inactive or ended.</span>{" "}
              {isAdmin
                ? "Renew to restore Pro features, add-ons, and full seat limits."
                : "Ask your workspace admin to renew. Some features may be limited."}
            </p>
          </div>
          {isAdmin && (
            <Link
              href={`/t/${encodeURIComponent(slug)}/billing`}
              className="inline-flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2 shrink-0"
            >
              View billing & upgrade
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (data.showFreeUpgradeCta) {
    return (
      <div className="shrink-0 border-b border-primary-500/30 bg-primary-500/10 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2 text-sm text-primary-950 dark:text-primary-100">
            <Sparkles className="w-5 h-5 shrink-0 text-primary-600 dark:text-primary-400 mt-0.5" />
            <p>
              <span className="font-semibold">You are on the Free plan.</span> Upgrade to Pro for more seats, team
              chat, recurring tasks, and AI add-ons.
            </p>
          </div>
          <Link
            href={`/t/${encodeURIComponent(slug)}/billing`}
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 shrink-0"
          >
            View plans & billing
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
