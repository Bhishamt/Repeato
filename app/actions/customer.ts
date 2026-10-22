"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { DomainError, joinBusiness, redeemReward } from "@/lib/services";
import { withQuery } from "@/lib/format";
import { positiveInt, text } from "@/lib/validate";

export async function joinFromQr(formData: FormData) {
  const slug = text(formData.get("slug"), 1, 60);
  if (!slug) redirect("/");
  const user = await getSessionUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/join/${slug}`)}`);
  const db = getDb();
  const business = db.prepare("SELECT id FROM businesses WHERE slug = ?").get(slug) as { id: number } | undefined;
  if (!business) redirect("/join/" + slug);

  try {
    const result = joinBusiness(db, user.id, business.id);
    redirect(`/join/${slug}?joined=${result.joined ? "1" : "0"}&bonus=${result.bonus}`);
  } catch (error) {
    // A redirect() inside try throws; rethrow it instead of reporting a false failure.
    unstable_rethrow(error);
    redirect(`/join/${slug}?error=${encodeURIComponent("This business is not accepting members right now.")}`);
  }
}

export async function joinFromDirectory(formData: FormData) {
  const slug = text(formData.get("slug"), 1, 60);
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fapp%2Fbusinesses");
  if (!slug) redirect("/app/businesses");
  const db = getDb();
  const business = db.prepare("SELECT id FROM businesses WHERE slug = ? AND status = 'active'").get(slug) as
    | { id: number }
    | undefined;
  if (!business) redirect("/app/businesses?error=" + encodeURIComponent("That business is not available."));
  try {
    const result = joinBusiness(db, user.id, business.id);
    redirect(
      `/app/businesses?msg=${encodeURIComponent(
        result.joined ? `Joined. ${result.bonus ? `${result.bonus} welcome points added.` : "Your wallet is ready."}` : "You are already a member.",
      )}`,
    );
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof DomainError ? error.message : "Could not join this business.";
    redirect(`/app/businesses?error=${encodeURIComponent(message)}`);
  }
}

export async function redeem(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fapp%2Frewards");
  const businessId = positiveInt(formData.get("businessId"));
  const rewardId = positiveInt(formData.get("rewardId"));
  const back = text(formData.get("back"), 1, 120) ?? "/app/rewards";
  if (!businessId || !rewardId) redirect(withQuery(back, "error", "Choose a reward first."));

  try {
    const result = redeemReward(getDb(), { customerId: user.id, businessId, rewardId });
    redirect(`/app/vouchers?issued=${result.token}&msg=${encodeURIComponent(`${result.rewardName} is ready - show the code at the counter.`)}`);
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof DomainError ? error.message : "That redemption could not be completed.";
    redirect(withQuery(back, "error", message));
  }
}

export async function updateProfile(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fapp%2Fprofile");
  const name = text(formData.get("name"), 2, 80);
  if (!name) redirect("/app/profile?error=" + encodeURIComponent("Enter your name."));
  const rawPhone = text(formData.get("phone"), 0, 30);
  const phone = rawPhone ? rawPhone.replace(/[^\d+\s-]/g, "").slice(0, 20) : null;
  getDb().prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, phone, user.id);
  redirect("/app/profile?msg=" + encodeURIComponent("Profile updated."));
}

export async function markNotificationsRead() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fapp%2Fnotifications");
  getDb().prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(user.id);
  redirect("/app/notifications?msg=" + encodeURIComponent("All notifications marked read."));
}
