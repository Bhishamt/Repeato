import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryLimit, rateLimit, resetLimits } from "../lib/rate-limit";

describe("rate-limiter", () => {
  beforeEach(() => {
    resetLimits();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    resetLimits();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("permits operations up to the configured limit and blocks excess", () => {
    const key = "test:local:key";
    expect(memoryLimit(key, 3, 60_000)).toBe(true);
    expect(memoryLimit(key, 3, 60_000)).toBe(true);
    expect(memoryLimit(key, 3, 60_000)).toBe(true);
    expect(memoryLimit(key, 3, 60_000)).toBe(false);
  });

  it("keeps rate-limit buckets isolated across different keys", () => {
    expect(memoryLimit("user:1", 1, 60_000)).toBe(true);
    expect(memoryLimit("user:1", 1, 60_000)).toBe(false);
    expect(memoryLimit("user:2", 1, 60_000)).toBe(true);
  });

  it("resets limits when explicitly requested", () => {
    expect(memoryLimit("user:reset", 1, 60_000)).toBe(true);
    expect(memoryLimit("user:reset", 1, 60_000)).toBe(false);
    resetLimits();
    expect(memoryLimit("user:reset", 1, 60_000)).toBe(true);
  });

  it("falls back to memory counter when Redis is unconfigured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const key = "test:no-redis";
    expect(await rateLimit(key, 2, 60_000)).toBe(true);
    expect(await rateLimit(key, 2, 60_000)).toBe(true);
    expect(await rateLimit(key, 2, 60_000)).toBe(false);
  });

  it("degrades gracefully (fail-open to local memory) during Redis outage for standard operations", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token");

    // Mock fetch to simulate Redis failure
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection timeout to Redis")));

    const key = "login:test@example.com";
    // Fails open to local memory counter
    const result1 = await rateLimit(key, 5, 60_000);
    expect(result1).toBe(true);

    const result2 = await rateLimit(key, 5, 60_000);
    expect(result2).toBe(true);
  });

  it("fails closed during Redis outage for sensitive operations with failClosed: true", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token");

    // Mock fetch to simulate Redis failure
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection timeout to Redis")));

    const key = "reset:test@example.com";
    // Sensitive endpoints fail closed to prevent mass spam
    const result = await rateLimit(key, 3, 60_000, { failClosed: true });
    expect(result).toBe(false);
  });
});
