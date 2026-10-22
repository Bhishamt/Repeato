"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
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
  const result = db.prepare("UPDATE businesses SET status = ? WHERE id = ?").run(status, businessId);
  if (!result.changes) redirect(withQuery(back, "error", "Business not found."));
  audit(db, admin.id, "business.status", "business", businessId, { status });
  redirect(withQuery(back, "ok", `Business marked ${status}.`));
}
