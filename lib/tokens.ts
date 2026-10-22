import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/lib/db";

export type TokenKind = "verify" | "reset";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/*
 * Timestamps are written as ISO-8601 UTC strings and compared as parameters, so
 * one statement works on SQLite (text) and Postgres (timestamptz) alike.
 */
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

/** Creates a single-use token and returns the raw value; only its hash is stored. */
export async function issueEmailToken(
  db: Db,
  userId: number,
  kind: TokenKind,
  ttlMinutes: number,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  // Any earlier unused token of the same kind is retired so only the newest link works.
  await db
    .prepare("UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND kind = ? AND used_at IS NULL")
    .run(iso(), userId, kind);
  await db
    .prepare("INSERT INTO email_tokens (user_id, kind, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .run(userId, kind, hashToken(raw), iso(ttlMinutes * 60_000));
  return raw;
}

/**
 * Marks a token used and returns its user id. The guarded UPDATE means two
 * simultaneous submissions cannot both succeed.
 */
export async function consumeEmailToken(db: Db, raw: string, kind: TokenKind): Promise<number | null> {
  if (!raw || raw.length < 16) return null;
  const row = await db
    .prepare(
      "UPDATE email_tokens SET used_at = ? WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id",
    )
    .get<{ user_id: number }>(iso(), hashToken(raw), kind, iso());
  return row?.user_id ?? null;
}
