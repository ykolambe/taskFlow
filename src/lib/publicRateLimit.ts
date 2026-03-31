/**
 * Best-effort in-memory rate limit for public routes (single-instance / dev).
 * Key should include route name + client id (e.g. IP).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function takePublicRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

export function clientKeyFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "unknown";
}
