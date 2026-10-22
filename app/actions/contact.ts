"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  business: z.string().trim().max(100).optional().default(""),
  message: z.string().trim().min(10).max(2000),
});

export async function sendContactMessage(formData: FormData) {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    business: formData.get("business") ?? "",
    message: formData.get("message"),
  });
  if (!parsed.success) {
    redirect("/contact?error=" + encodeURIComponent("Add your name, a valid email, and a message of at least 10 characters."));
  }
  const { name, email, business, message } = parsed.data;
  if (!(await rateLimit(`contact:${email}`, 3, 60 * 60 * 1000))) {
    redirect("/contact?error=" + encodeURIComponent("That email has sent several messages already. Try again later."));
  }

  const db = getDb();
  const admins = await db
    .prepare("SELECT id FROM users WHERE role = 'admin' AND status = 'active'")
    .all<{ id: number }>();
  const insert = db.prepare("INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)");
  const body = `From ${name} <${email}>${business ? ` (${business})` : ""}\n\n${message}`;
  for (const admin of admins) await insert.run(admin.id, "Website enquiry", body);
  await db
    .prepare("INSERT INTO audit_log (actor_id, action, entity, entity_id, meta) VALUES (NULL, ?, 'contact', ?, ?)")
    .run("contact.message", email, JSON.stringify({ name, business }));
  redirect("/contact?sent=1");
}
