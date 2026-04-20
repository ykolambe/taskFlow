"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

/**
 * Hides the native launch splash once the WebView has finished loading the first page.
 * Required when `launchAutoHide` is false so slow networks still see the branded splash.
 */
export default function CapacitorSplashScreen() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    const hide = async () => {
      if (cancelled) return;
      try {
        await SplashScreen.hide({ fadeOutDuration: 320 });
      } catch {
        /* no-op: plugin unavailable outside native shell */
      }
    };

    const safety = window.setTimeout(() => {
      void hide();
    }, 18_000);

    const onReady = () => {
      window.clearTimeout(safety);
      void hide();
    };

    if (document.readyState === "complete") {
      void onReady();
    } else {
      window.addEventListener("load", onReady, { once: true });
    }

    return () => {
      cancelled = true;
      window.clearTimeout(safety);
      window.removeEventListener("load", onReady);
    };
  }, []);

  return null;
}
