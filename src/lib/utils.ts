import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, endOfDay } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date Helpers ─────────────────────────────────────────────────────────

function parseAppDate(date: Date | string): Date {
  if (date instanceof Date) return date;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, monthIndex, day);
  }
  return new Date(date);
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = parseAppDate(date);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "MMM d, yyyy");
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return "—";
  return format(parseAppDate(date), "MMM d, yyyy 'at' h:mm a");
}

export function formatRelative(date: Date | string | null): string {
  if (!date) return "—";
  return formatDistanceToNow(parseAppDate(date), { addSuffix: true });
}

export function isOverdue(date: Date | string | null): boolean {
  if (!date) return false;
  // For due dates without times, treat end of local day as deadline.
  return isPast(endOfDay(parseAppDate(date)));
}

// ─── String Helpers ───────────────────────────────────────────────────────

export function getInitials(firstName: string, lastName: string, email?: string | null): string {
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();
  if (f && l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
  if (f.length >= 2) return f.slice(0, 2).toUpperCase();
  if (f) return f.charAt(0).toUpperCase();
  if (l) return l.charAt(0).toUpperCase();
  const local = (email || "").split("@")[0]?.trim();
  if (local && local.length >= 2) return local.slice(0, 2).toUpperCase();
  if (local) return local.charAt(0).toUpperCase();
  return "?";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateUsername(firstName: string, lastName: string): string {
  return `${firstName.toLowerCase()}${lastName.toLowerCase().charAt(0)}${Math.floor(Math.random() * 100)}`;
}

export function generatePassword(length = 12): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "@#$!";
  const all = upper + lower + digits + special;
  let password =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)] +
    special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

// ─── Task Helpers ─────────────────────────────────────────────────────────

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  READY_FOR_REVIEW: "Ready for Review",
  COMPLETED: "Completed",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: "bg-surface-600 text-surface-200",
  IN_PROGRESS: "bg-blue-500/20 text-blue-400",
  READY_FOR_REVIEW: "bg-amber-500/20 text-amber-400",
  COMPLETED: "bg-emerald-500/20 text-emerald-400",
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-emerald-500/20 text-emerald-400",
  MEDIUM: "bg-blue-500/20 text-blue-400",
  HIGH: "bg-amber-500/20 text-amber-400",
  URGENT: "bg-red-500/20 text-red-400",
};

export const PRIORITY_DOT_COLORS: Record<string, string> = {
  LOW: "bg-emerald-400",
  MEDIUM: "bg-blue-400",
  HIGH: "bg-amber-400",
  URGENT: "bg-red-400",
};

// ─── Hierarchy Helpers ────────────────────────────────────────────────────

export function canAssignTask(
  assignerLevel: number,
  assigneeLevel: number
): boolean {
  // Can assign to yourself or people below (higher level number)
  return assignerLevel <= assigneeLevel;
}

export function canCompleteTask(
  userLevel: number,
  creatorLevel: number
): boolean {
  // Can complete only if you're the creator or higher (lower level number)
  return userLevel <= creatorLevel;
}

/** Super admin or top of org hierarchy (role level 1). Can set any task status. */
export function canManageAnyTaskStatus(user: {
  isSuperAdmin: boolean;
  level: number;
}): boolean {
  return user.isSuperAdmin || user.level === 1;
}

/** Broader “leadership” dashboard: C-suite / directors (levels 1–2) and super admins. */
export function isExecutiveDashboardUser(user: { isSuperAdmin: boolean; level: number }): boolean {
  return user.isSuperAdmin || user.level <= 2;
}

// ─── Recurring Task Helpers ───────────────────────────────────────────────

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getNextDueDate(
  frequency: string,
  daysOfWeek: number[],
  dayOfMonth: number | null,
  fromDate?: Date
): Date {
  const base = fromDate ?? new Date();
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  if (frequency === "DAILY") {
    const next = new Date(today);
    next.setDate(next.getDate() + 1);
    return next;
  }

  if (frequency === "WEEKLY" && daysOfWeek.length > 0) {
    const todayDow = today.getDay();
    const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
    const nextDay = sortedDays.find((d) => d > todayDow) ?? sortedDays[0];
    const daysUntil =
      nextDay > todayDow
        ? nextDay - todayDow
        : 7 - todayDow + nextDay;
    const next = new Date(today);
    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  if (frequency === "MONTHLY" && dayOfMonth) {
    const next = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
    if (next <= today) {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  return new Date(today.setDate(today.getDate() + 1));
}

/**
 * Copy text to the clipboard. Uses the Clipboard API when available; falls back to
 * `document.execCommand("copy")` so copy works on plain HTTP (e.g. `http://1.2.3.4:3000`),
 * where `navigator.clipboard` is often blocked (requires secure context).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
