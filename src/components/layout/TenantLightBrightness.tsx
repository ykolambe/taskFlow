"use client";

import { useLayoutEffect } from "react";
import type { UiTheme } from "@prisma/client";

export const TENANT_LIGHT_BRIGHTNESS_KEY = "tenant-light-brightness";
/** 88 = softer / dimmer, 100 = default, 112 = brighter */
const MIN = 88;
const MAX = 112;
const DEFAULT = 100;

function clamp(n: number): number {
  if (Number.isNaN(n)) return DEFAULT;
  return Math.min(MAX, Math.max(MIN, n));
}

function applyLightBrightness(pct: number) {
  const root = document.documentElement;
  if (root.classList.contains("dark")) {
    root.style.removeProperty("--surf-950");
    root.style.removeProperty("--surf-900");
    root.style.removeProperty("--bg");
    return;
  }

  const factor = clamp(pct) / 100;
  const base950: [number, number, number] = [235, 240, 246];
  const base900: [number, number, number] = [252, 252, 253];
  const rgb950 = base950.map((c) => Math.min(255, Math.round(c * factor)));
  const rgb900 = base900.map((c) => Math.min(255, Math.round(c * factor)));
  root.style.setProperty("--surf-950", rgb950.join(" "));
  root.style.setProperty("--surf-900", rgb900.join(" "));

  const bgHex = "#e8edf3";
  const r = parseInt(bgHex.slice(1, 3), 16);
  const g = parseInt(bgHex.slice(3, 5), 16);
  const b = parseInt(bgHex.slice(5, 7), 16);
  const bgR = Math.min(255, Math.round(r * factor));
  const bgG = Math.min(255, Math.round(g * factor));
  const bgB = Math.min(255, Math.round(b * factor));
  root.style.setProperty("--bg", `rgb(${bgR} ${bgG} ${bgB})`);
}

/**
 * Applies stored light-mode background brightness (localStorage). No-op in dark theme.
 */
export default function TenantLightBrightness({ uiTheme }: { uiTheme: UiTheme }) {
  useLayoutEffect(() => {
    const sync = () => {
      let pct = DEFAULT;
      try {
        const raw = localStorage.getItem(TENANT_LIGHT_BRIGHTNESS_KEY);
        if (raw != null) pct = clamp(parseInt(raw, 10));
      } catch {
        /* ignore */
      }
      applyLightBrightness(uiTheme === "DARK" ? DEFAULT : pct);
    };

    sync();

    const onStorage = (e: StorageEvent) => {
      if (e.key === TENANT_LIGHT_BRIGHTNESS_KEY) sync();
    };
    const onCustom = () => sync();

    window.addEventListener("storage", onStorage);
    window.addEventListener("tenant-light-brightness-change", onCustom as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tenant-light-brightness-change", onCustom as EventListener);
    };
  }, [uiTheme]);

  return null;
}

export { MIN as LIGHT_BRIGHTNESS_MIN, MAX as LIGHT_BRIGHTNESS_MAX, DEFAULT as LIGHT_BRIGHTNESS_DEFAULT };
