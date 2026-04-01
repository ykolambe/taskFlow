"use client";

import { useLayoutEffect, type ReactNode } from "react";
import type { UiFontScale, UiTheme } from "@prisma/client";

type Props = {
  uiTheme: UiTheme;
  uiFontScale: UiFontScale;
  children: ReactNode;
};

/**
 * Applies workspace UI preferences to <html> (Tailwind `dark` + base font scale).
 * Lives in `app/t/[slug]/layout.tsx` so it persists across tenant routes without remount flicker.
 */
export default function TenantThemeProvider({ uiTheme, uiFontScale, children }: Props) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (uiTheme === "DARK") root.classList.add("dark");
    else root.classList.remove("dark");
    root.dataset.fontScale = uiFontScale.toLowerCase();
    return () => {
      root.classList.add("dark");
      delete root.dataset.fontScale;
    };
  }, [uiTheme, uiFontScale]);

  return <>{children}</>;
}
