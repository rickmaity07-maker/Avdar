/**
 * Minimal in-memory sliding-window rate limiter. Good enough to stop casual
 * abuse/bots on a low-to-medium traffic site without adding a new service.
 * Limitation: resets on cold start and isn't shared across serverless
 * instances, so it's a best-effort deterrent, not a hard guarantee — if
 * traffic grows, replace with Upstash Redis (same pattern as the Karmel
 * project already uses) for a properly distributed limit.
 */
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    buckets.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
  return false;
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}