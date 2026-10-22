import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

export const SESSION_COOKIE = "rp_session";
const SESSION_DAYS = 30;

export type Role = "owner" | "staff" | "customer" | "admin";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
};

export type BusinessMembership = {
  businessId: number;
  businessName: string;
  businessSlug: string;
  role: "owner" | "staff";
};

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Timestamps are always bound from JS so SQLite text and Postgres timestamptz agree. */
const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export async function startSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  await getDb()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(tokenHash(token), userId, isoIn(SESSION_DAYS));
  await pruneSessions();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  jar.delete(SESSION_COOKIE);
}

/** Signs every device out of an account (password change, suspension, admin action). */
export async function revokeUserSessions(userId: number) {
  await getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

/** Expired rows are pruned opportunistically; there is no cron dependency. */
async function pruneSessions() {
  await getDb().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
}

/** Resolved once per request so layouts, pages and actions share one query. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await getDb()
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.status
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get<SessionUser>(tokenHash(token), new Date().toISOString());
  return row ?? null;
});

export async function requireUser(nextPath = "/app"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (user.status !== "active") redirect("/login?error=" + encodeURIComponent("This account is suspended."));
  return user;
}

/** Console access comes from a membership, not from the global account role. */
export async function requireBusinessUser(nextPath = "/biz"): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  const memberships = await membershipsFor(user.id);
  const member = user.role === "owner" || user.role === "staff" || memberships.length > 0;
  if (!member) {
    redirect("/login?error=" + encodeURIComponent("Sign in with a business account."));
  }
  return user;
}

export async function requireAdmin(nextPath = "/admin"): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (user.role !== "admin") {
    redirect("/login?error=" + encodeURIComponent("Sign in with an administrator account."));
  }
  return user;
}

export async function membershipsFor(userId: number): Promise<BusinessMembership[]> {
  return getDb()
    .prepare(
      `SELECT m.business_id AS "businessId", b.name AS "businessName", b.slug AS "businessSlug", m.role
         FROM business_members m JOIN businesses b ON b.id = m.business_id
        WHERE m.user_id = ? ORDER BY b.name`,
    )
    .all<BusinessMembership>(userId);
}

/** First membership is the console's active business; switching is supported via ?b= later. */
export async function activeMembership(userId: number, requestedId?: number): Promise<BusinessMembership | null> {
  const all = await membershipsFor(userId);
  if (requestedId) return all.find((m) => m.businessId === requestedId) ?? null;
  return all[0] ?? null;
}

export const homeFor = (role: Role) =>
  role === "admin" ? "/admin" : role === "owner" || role === "staff" ? "/biz" : "/app";
