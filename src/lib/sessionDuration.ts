/**
 * Single source for JWT expiry and auth cookie maxAge (must stay in sync).
 * Default 7 days; override with SESSION_MAX_AGE_DAYS (integer, clamped 1–365).
 */
const DEFAULT_DAYS = 7;
const MIN_DAYS = 1;
const MAX_DAYS = 365;

function parseSessionMaxAgeDays(): number {
  const raw = process.env.SESSION_MAX_AGE_DAYS?.trim();
  if (!raw) return DEFAULT_DAYS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < MIN_DAYS) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, n);
}

/** Cached per process after first read. */
let cachedDays: number | null = null;

export function getSessionMaxAgeDays(): number {
  if (cachedDays === null) cachedDays = parseSessionMaxAgeDays();
  return cachedDays;
}

export function getSessionMaxAgeSeconds(): number {
  return getSessionMaxAgeDays() * 24 * 60 * 60;
}

/** jose `setExpirationTime` accepts e.g. "7d". */
export function getJwtExpirationDurationString(): string {
  return `${getSessionMaxAgeDays()}d`;
}
