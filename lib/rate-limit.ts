const buckets = new Map<string, { count: number; resetAt: number }>();

/*
 * Process-local sliding window limiter. Enough for a single-node deployment and
 * for abuse-tests; swap for Redis when the app runs on multiple instances.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

export function resetLimits() {
  buckets.clear();
}
