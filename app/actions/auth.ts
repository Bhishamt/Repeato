"use server";

import { redirect } from "next/navigation";
import { getDb, type Db } from "@/lib/db";
import { endSession, getSessionUser, hashPassword, revokeUserSessions, startSession, verifyPassword } from "@/lib/auth";
import { audit, createBusiness } from "@/lib/services";
import { email as parseEmail, password as parsePassword, safeNext, text } from "@/lib/validate";
import { rateLimit } from "@/lib/rate-limit";
import { withQuery } from "@/lib/format";
import { appUrl, sendMail } from "@/lib/email";
import { consumeEmailToken, issueEmailToken } from "@/lib/tokens";

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
  await sendVerificationEmailFor(db, userId, mail, name);
  await startSession(userId);
  redirect(next);
}

/** Sends a verification link. Never throws: a mail outage must not lose a signup. */
async function sendVerificationEmailFor(db: Db, userId: number, mail: string, name: string) {
  try {
    const raw = await issueEmailToken(db, userId, "verify", 24 * 60);
    await sendMail({
      to: mail,
      subject: "Confirm your Repeato email",
      text: `Hi ${name},\n\nConfirm your email address to finish setting up Repeato:\n${appUrl()}/verify?token=${raw}\n\nThe link works once and expires in 24 hours.`,
    });
  } catch (error) {
    console.error("verification email failed", error);
  }
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

/* --------------------------------------------------- email + password reset */

export async function requestPasswordReset(formData: FormData) {
  const mail = parseEmail(formData.get("email"));
  if (!(await rateLimit(`reset:${mail ?? "invalid"}`, 3, 60 * 60 * 1000, { failClosed: true }))) {
    fail("/forgot", "Too many reset requests or service busy. Try again later.");
  }

  if (mail) {
    const db = getDb();
    const user = await db
      .prepare("SELECT id, name FROM users WHERE lower(email) = ? AND status = 'active'")
      .get<{ id: number; name: string }>(mail);
    if (user) {
      try {
        const raw = await issueEmailToken(db, user.id, "reset", 60);
        await sendMail({
          to: mail,
          subject: "Reset your Repeato password",
          text: `Hi ${user.name},\n\nUse this link to choose a new password:\n${appUrl()}/reset?token=${raw}\n\nThe link works once and expires in 60 minutes. If you did not ask for this, ignore the email.`,
        });
        await audit(db, user.id, "auth.reset_requested", "user", user.id);
      } catch (error) {
        console.error("password reset email failed", error);
      }
    }
  }

  // Same message whether or not the account exists, so this cannot enumerate users.
  redirect(
    withQuery(
      "/forgot",
      "ok",
      "If that email has an account, a reset link is on its way. The link expires in 60 minutes.",
    ),
  );
}

export async function resetPassword(formData: FormData) {
  const token = text(formData.get("token"), 16, 200);
  const nextPass = parsePassword(formData.get("password"));
  const confirm = formData.get("confirm");
  const back = `/reset?token=${encodeURIComponent(token ?? "")}`;

  if (!token) fail("/forgot", "Open the link from your reset email, or request a new one.");
  if (!nextPass) fail(back, "Use a password of at least 8 characters.");
  if (nextPass !== confirm) fail(back, "The passwords do not match.");

  const db = getDb();
  const userId = await consumeEmailToken(db, token, "reset");
  if (!userId) fail("/reset", "That reset link is invalid or has expired. Request a new one.");

  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(nextPass), userId);
  // Anyone holding a stolen session loses it the moment the password changes.
  await revokeUserSessions(userId);
  await audit(db, userId, "auth.password_reset", "user", userId);
  redirect(withQuery("/login", "ok", "Password updated. Sign in with your new password."));
}

export async function sendVerificationEmail(formData: FormData) {
  const user = await getSessionUser();
  const back = safeNext(formData.get("back")) ?? "/app/profile";
  if (!user) fail("/login", "Sign in first.");

  const db = getDb();
  const row = await db.prepare("SELECT email_verified AS verified FROM users WHERE id = ?").get<{ verified: number }>(user.id);
  if (row?.verified === 1) redirect(withQuery(back, "ok", "Your email is already confirmed."));
  if (!(await rateLimit(`verify-send:${user.id}`, 3, 60 * 60 * 1000, { failClosed: true }))) {
    fail(back, "A confirmation email was sent recently or service busy. Check your inbox.");
  }

  await sendVerificationEmailFor(db, user.id, user.email, user.name);
  redirect(withQuery(back, "ok", "Confirmation email sent. The link works once and expires in 24 hours."));
}

export async function verifyEmailAddress(formData: FormData) {
  const token = text(formData.get("token"), 16, 200);
  if (!token) fail("/verify", "Open the link from your confirmation email.");

  const db = getDb();
  const userId = await consumeEmailToken(db, token, "verify");
  if (!userId) fail("/verify", "That confirmation link is invalid or has expired.");

  await db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(userId);
  await audit(db, userId, "auth.email_verified", "user", userId);
  redirect(withQuery("/login", "ok", "Email confirmed. Sign in to continue."));
}
