import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type Db } from "../lib/db";
import { consumeEmailToken, hashToken, issueEmailToken } from "../lib/tokens";

let db: Db;
let userId: number;

beforeEach(async () => {
  db = await createTestDb();
  userId = await db.insert("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)", "token@example.test", "Token Tester", "x", "customer");
});

afterEach(async () => {
  await db.close();
});

describe("email tokens", () => {
  it("stores only a hash of the token", async () => {
    const raw = await issueEmailToken(db, userId, "reset", 60);
    const row = await db.prepare("SELECT token_hash AS hash FROM email_tokens WHERE user_id = ?").get<{ hash: string }>(userId);
    expect(row?.hash).toBe(hashToken(raw));
    expect(row?.hash).not.toContain(raw);
  });

  it("accepts a reset token once and rejects the replay", async () => {
    const raw = await issueEmailToken(db, userId, "reset", 60);
    expect(await consumeEmailToken(db, raw, "reset")).toBe(userId);
    expect(await consumeEmailToken(db, raw, "reset")).toBeNull();
  });

  it("will not spend a reset token as a verification token", async () => {
    const raw = await issueEmailToken(db, userId, "reset", 60);
    expect(await consumeEmailToken(db, raw, "verify")).toBeNull();
    expect(await consumeEmailToken(db, raw, "reset")).toBe(userId);
  });

  it("retires an older unused token when a new one is issued", async () => {
    const first = await issueEmailToken(db, userId, "reset", 60);
    const second = await issueEmailToken(db, userId, "reset", 60);
    expect(await consumeEmailToken(db, first, "reset")).toBeNull();
    expect(await consumeEmailToken(db, second, "reset")).toBe(userId);
  });

  it("rejects an expired token", async () => {
    const raw = "expired-token-value-1234567890";
    await db
      .prepare("INSERT INTO email_tokens (user_id, kind, token_hash, expires_at) VALUES (?, ?, ?, ?)")
      .run(userId, "reset", hashToken(raw), new Date(Date.now() - 60_000).toISOString());
    expect(await consumeEmailToken(db, raw, "reset")).toBeNull();
  });

  it("lets only one of two concurrent submissions spend the token", async () => {
    const raw = await issueEmailToken(db, userId, "reset", 60);
    const results = await Promise.all([consumeEmailToken(db, raw, "reset"), consumeEmailToken(db, raw, "reset")]);
    expect(results.filter((value) => value === userId)).toHaveLength(1);
  });

  it("rejects junk input without touching the database", async () => {
    expect(await consumeEmailToken(db, "", "reset")).toBeNull();
    expect(await consumeEmailToken(db, "short", "reset")).toBeNull();
  });
});
