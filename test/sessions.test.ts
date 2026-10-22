import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_PATH = ":memory:";

let db: import("../lib/db").Db;
let revokeUserSessions: (userId: number) => Promise<void>;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

async function addSession(userId: number, token: string, expiresAt: string) {
  await db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(hash(token), userId, expiresAt);
}

async function liveSessions(userId: number, token: string) {
  return db
    .prepare("SELECT token_hash FROM sessions WHERE user_id = ? AND token_hash = ? AND expires_at > ?")
    .all(userId, hash(token), new Date().toISOString());
}

beforeAll(async () => {
  const dbModule = await import("../lib/db");
  const authModule = await import("../lib/auth");
  db = await dbModule.getDb();
  revokeUserSessions = authModule.revokeUserSessions;
});

afterAll(async () => {
  const dbModule = await import("../lib/db");
  await dbModule.closeDb();
});

describe("sessions", () => {
  it("stores only the hash of a session token", async () => {
    const userId = await db.insert("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)", "hash@example.test", "Hash", "x", "customer");
    await addSession(userId, "raw-token-value", future());
    const raw = await db.prepare("SELECT token_hash FROM sessions WHERE token_hash = ?").all("raw-token-value");
    expect(raw).toHaveLength(0);
    expect(await liveSessions(userId, "raw-token-value")).toHaveLength(1);
  });

  it("does not resolve an expired session", async () => {
    const userId = await db.insert("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)", "expired@example.test", "Expired", "x", "customer");
    await addSession(userId, "stale-token", past());
    expect(await liveSessions(userId, "stale-token")).toHaveLength(0);
  });

  it("revokes every session for a user", async () => {
    const userId = await db.insert("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)", "revoke@example.test", "Revoke", "x", "customer");
    const other = await db.insert("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)", "keep@example.test", "Keep", "x", "customer");
    await addSession(userId, "phone", future());
    await addSession(userId, "laptop", future());
    await addSession(other, "unrelated", future());

    await revokeUserSessions(userId);

    expect(await liveSessions(userId, "phone")).toHaveLength(0);
    expect(await liveSessions(userId, "laptop")).toHaveLength(0);
    expect(await liveSessions(other, "unrelated")).toHaveLength(1);
  });
});
