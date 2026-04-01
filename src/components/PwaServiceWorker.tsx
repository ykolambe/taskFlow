"use client";

import { useEffect } from "react";

/**
 * Registers a minimal service worker for installability.
 * Cache strategy remains conservative (network-first in SW).
 */
export default function PwaServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (err) {
        console.error("SW registration failed:", err);
      }
    };

    void register();
  }, []);

  return null;
}
