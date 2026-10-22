const buckets = new Map<string, { count: number; resetAt: number }>();

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function redisCall(url: string, token: string, command: (string | number)[]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`rate limit store responded ${response.status}`);
  return (await response.json()) as { result?: number | string };
}

export function memoryLimit(key: string, max: number, windowMs: number): boolean {
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

export type RateLimitOptions = {
  /**
   * When true and Redis is configured but encounters an outage, this request
   * fails closed (returns false) to prevent abuse of outbound email or public abuse vectors.
   * When false or omitted, the request degrades to the process-local memory counter.
   */
  failClosed?: boolean;
};

/*
 * Fixed-window limiter with hybrid resilience.
 *
 * Production strategy:
 * - Shared store (Upstash Redis) when configured: synchronized across instances.
 * - Outage on sensitive endpoints (password reset, email verification, contact):
 *   fails closed when options.failClosed = true to avoid mass outbound spam/inbox flooding.
 * - Outage on essential operations (login, signup, customer/staff actions):
 *   degrades to process-local counter to preserve reliable sign-in and business continuity.
 * - Without Redis configured (local dev, single-node, tests):
 *   falls back to process memory.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  options?: RateLimitOptions,
): Promise<boolean> {
  const redis = getRedisConfig();
  if (!redis) return memoryLimit(key, max, windowMs);

  try {
    const bucketKey = `rl:${key}`;
    const inc = await redisCall(redis.url, redis.token, ["INCR", bucketKey]);
    const count = Number(inc.result ?? 0);
    if (count === 1) await redisCall(redis.url, redis.token, ["PEXPIRE", bucketKey, windowMs]);
    return count <= max;
  } catch (error) {
    if (options?.failClosed) {
      console.error(`rate limit store unavailable; failing closed for sensitive key '${key}'`, error);
      return false;
    }
    console.warn(`rate limit store unavailable; degrading to process-local counter for '${key}'`, error);
    return memoryLimit(key, max, windowMs);
  }
}

export function isRedisConfigured(): boolean {
  return Boolean(getRedisConfig());
}

export function resetLimits() {
  buckets.clear();
}
