"use client";

import { useEffect } from "react";

export default function TenantRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[t/[slug] route error]", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
      <p className="text-sm font-semibold text-red-400 mb-2">Something went wrong</p>
      <h1 className="text-lg font-bold text-surface-50 mb-2">This page couldn&apos;t load</h1>
      <p className="text-sm text-surface-500 mb-4">
        {process.env.NODE_ENV === "development" ? (
          <span className="font-mono text-left block whitespace-pre-wrap break-words text-red-300/90">
            {error.message}
            {error.digest ? `\nDigest: ${error.digest}` : ""}
          </span>
        ) : (
          "Reload to try again, or go back."
        )}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => history.back()}
          className="px-4 py-2 rounded-lg border border-surface-600 text-surface-200 text-sm hover:bg-surface-800"
        >
          Back
        </button>
      </div>
    </div>
  );
}
