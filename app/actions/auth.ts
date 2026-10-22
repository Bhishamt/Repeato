"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { endSession, getSessionUser, hashPassword, revokeUserSessions, startSession, verifyPassword } from "@/lib/auth";
import { audit, createBusiness } from "@/lib/services";
import { email as parseEmail, password as parsePassword, safeNext, text } from "@/lib/validate";
import { rateLimit } from "@/lib/rate-limit";
import { withQuery } from "@/lib/format";

function fail(path: string, message: string): never {
  redirect(withQuery(path, "error", message));
}

// Compared against when the email is unknown, so a missing account costs the
// same scrypt work as a wrong password and cannot be told apart by timing.
const TIMING_HASH = hashPassword("repeato-timing-equaliser");

export async function signUp(formData: FormData) {
  const intent = formData.get("intent") === "owner" ? "owner" : "customer";
  const path = intent === "owner" ? "/signup?as=business" : "/signup?as=customer";
  const name = text(formData.get("name"), 2, 80);
  const mail = parseEmail(formData.get("email"));
  const pass = parsePassword(formData.get("password"));
  const next = safeNext(formData.get("next")) ?? (intent === "owner" ? "/biz" : "/app");

  if (!name) fail(path, "Enter your name.");
  if (!mail) fail(path, "Enter a valid email address.");
  if (!pass) fail(path, "Use a password of at least 8 characters.");
  if (formData.get("confirm") !== pass) fail(path, "The passwords do not match.");
  if (!(await rateLimit(`signup:${mail}`, 5, 60 * 60 * 1000))) fail(path, "Too many attempts for this email. Try again later.");

  const businessName = intent === "owner" ? text(formData.get("businessName"), 2, 80) : null;
  const category = text(formData.get("category"), 2, 40) ?? "Cafe";
  const city = text(formData.get("city"), 2, 60);
  if (intent === "owner" && !businessName) fail(path, "Enter your business name.");

  const db = getDb();
  const existing = await db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(mail);
  if (existing) fail(path, "An account with that email already exists. Sign in instead.");

  let userId: number;
  try {
    userId = await db.insert(
      "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)",
      mail,
      name,
      hashPassword(pass),
      intent === "owner" ? "owner" : "customer",
    );
  } catch {
    fail(path, "That email is already registered. Try signing in.");
  }

  if (intent === "owner" && businessName) {
    await createBusiness(db, { ownerId: userId, name: businessName, category, city: city ?? undefined });
  }
  await audit(db, userId, "auth.signup", "user", userId, { intent });
  await startSession(userId);
  redirect(next);
}

export async function signIn(formData: FormData) {
  const mail = parseEmail(formData.get("email"));
  const pass = formData.get("password");
  const next = safeNext(formData.get("next"));
  if (!mail || typeof pass !== "string" || !pass) fail("/login", "Enter your email and password.");
  if (!(await rateLimit(`login:${mail}`, 8, 10 * 60 * 1000))) fail("/login", "Too many attempts. Wait a few minutes and try again.");

  const db = getDb();
  const row = await db
    .prepare("SELECT id, password_hash AS hash, role, status FROM users WHERE lower(email) = ?")
    .get<{ id: number; hash: string; role: string; status: string }>(mail);

  const valid = verifyPassword(pass, row?.hash ?? TIMING_HASH);
  if (!row || !valid) fail("/login", "That email and password do not match.");
  if (row.status !== "active") fail("/login", "This account is suspended. Contact support.");

  await startSession(row.id);
  const home = row.role === "admin" ? "/admin" : row.role === "owner" || row.role === "staff" ? "/biz" : "/app";
  redirect(next ?? home);
}

export async function signOut() {
  await endSession();
  redirect("/");
}

export async function changePassword(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fapp%2Fprofile");
  const current = formData.get("current");
  const nextPass = parsePassword(formData.get("password"));
  const confirm = formData.get("confirm");
  const back = user.role === "owner" || user.role === "staff" ? "/biz/settings" : "/app/profile";

  if (nextPass !== confirm) fail(back, "The new passwords do not match.");
  if (!nextPass) fail(back, "Use a password of at least 8 characters.");

  const db = getDb();
  const row = await db.prepare("SELECT password_hash AS hash FROM users WHERE id = ?").get<{ hash: string }>(user.id);
  if (typeof current !== "string" || !row || !verifyPassword(current, row.hash)) {
    fail(back, "Your current password is incorrect.");
  }

  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(nextPass), user.id);
  // Every other device is signed out; this one gets a fresh session.
  await revokeUserSessions(user.id);
  await startSession(user.id);
  redirect(`${back}?msg=${encodeURIComponent("Password updated.")}`);
}
