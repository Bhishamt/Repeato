"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireAdmin, revokeUserSessions } from "@/lib/auth";
import { audit } from "@/lib/services";
import { positiveInt, safeNext } from "@/lib/validate";
import { withQuery } from "@/lib/format";

export async function setBusinessStatus(formData: FormData) {
  const admin = await requireAdmin("/admin");
  const back = safeNext(formData.get("back")) ?? "/admin/businesses";
  const businessId = positiveInt(formData.get("businessId"), 10_000_000);
  const status = String(formData.get("status") ?? "");
  if (!businessId || !["active", "suspended", "pending"].includes(status)) {
    redirect(withQuery(back, "error", "Unknown business or status."));
  }
  const db = getDb();
  const result = await db.prepare("UPDATE businesses SET status = ? WHERE id = ?").run(status, businessId);
  if (!result.changes) redirect(withQuery(back, "error", "Business not found."));
  await audit(db, admin.id, "business.status", "business", businessId, { status });
  redirect(withQuery(back, "ok", `Business marked ${status}.`));
}

/** Suspending an account must also kill its live sessions, not just block the next login. */
export async function setUserStatus(formData: FormData) {
  const admin = await requireAdmin("/admin");
  const back = safeNext(formData.get("back")) ?? "/admin/users";
  const userId = positiveInt(formData.get("userId"), 10_000_000);
  const status = String(formData.get("status") ?? "");
  if (!userId || !["active", "suspended"].includes(status)) {
    redirect(withQuery(back, "error", "Unknown account or status."));
  }
  if (userId === admin.id) redirect(withQuery(back, "error", "You cannot suspend your own account."));

  const db = getDb();
  const target = await db.prepare("SELECT role FROM users WHERE id = ?").get<{ role: string }>(userId);
  if (!target) redirect(withQuery(back, "error", "Account not found."));
  if (target.role === "admin") redirect(withQuery(back, "error", "Administrator accounts cannot be suspended here."));

  await db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, userId);
  if (status === "suspended") await revokeUserSessions(userId);
  await audit(db, admin.id, "user.status", "user", userId, { status });
  redirect(withQuery(back, "ok", `Account marked ${status}.`));
}
