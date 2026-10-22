const buckets = new Map<string, { count: number; resetAt: number }>();

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisCall(command: (string | number)[]) {
  const response = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`rate limit store responded ${response.status}`);
  return (await response.json()) as { result?: number | string };
}

function memoryLimit(key: string, max: number, windowMs: number): boolean {
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

/*
 * Fixed-window limiter. Uses Upstash Redis when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set so every instance shares one counter, and
 * falls back to process memory for local dev and single-node deployments.
 * A store outage fails open: a limiter must not lock everyone out of sign-in.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  if (!REDIS_URL || !REDIS_TOKEN) return memoryLimit(key, max, windowMs);
  try {
    const bucketKey = `rl:${key}`;
    const inc = await redisCall(["INCR", bucketKey]);
    const count = Number(inc.result ?? 0);
    if (count === 1) await redisCall(["PEXPIRE", bucketKey, windowMs]);
    return count <= max;
  } catch (error) {
    console.error("rate limit store unavailable", error);
    return true;
  }
}

export function resetLimits() {
  buckets.clear();
}
