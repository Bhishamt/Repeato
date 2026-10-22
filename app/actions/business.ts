"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { membershipsFor, requireBusinessUser } from "@/lib/auth";
import { BUSINESS_COOKIE } from "@/lib/console";
import {
  DomainError,
  adjustPoints,
  audit,
  createBusiness,
  getBusiness,
  recordPurchase,
  requireMember,
  reversePurchase,
  verifyRedemption,
} from "@/lib/services";
import { optionalText, positiveInt, safeNext, text, toPaise } from "@/lib/validate";
import { withQuery } from "@/lib/format";

type Ctx = { userId: number; businessId: number; back: string; db: ReturnType<typeof getDb> };

function fail(path: string, message: string): never {
  redirect(withQuery(path, "error", message));
}

async function handle(formData: FormData, need: "owner" | "any", fn: (ctx: Ctx) => void) {
  const back = safeNext(formData.get("back")) ?? "/biz";
  try {
    const user = await requireBusinessUser("/biz");
    const businessId = positiveInt(formData.get("businessId"), 10_000_000);
    if (!businessId) fail(back, "Missing business. Reload the console and try again.");
    const db = getDb();
    requireMember(db, user.id, businessId, need);
    fn({ userId: user.id, businessId, back, db });
  } catch (error) {
    if (error instanceof DomainError) fail(back, error.message);
    throw error;
  }
}

export async function createOwnBusiness(formData: FormData) {
  const user = await requireBusinessUser("/biz/onboarding");
  if (membershipsFor(user.id).length > 0) redirect("/biz");
  const name = text(formData.get("name"), 2, 80);
  const category = text(formData.get("category"), 2, 40) ?? "Cafe";
  const city = text(formData.get("city"), 2, 60);
  if (!name) fail("/biz/onboarding", "Enter your business name.");
  const { slug } = createBusiness(getDb(), { ownerId: user.id, name, category, city: city ?? undefined });
  getDb().prepare("UPDATE users SET role = 'owner' WHERE id = ? AND role = 'customer'").run(user.id);
  redirect(`/biz/qr?slug=${slug}`);
}

export async function switchBusiness(formData: FormData) {
  const user = await requireBusinessUser("/biz");
  const businessId = positiveInt(formData.get("businessId"), 10_000_000);
  const allowed = membershipsFor(user.id).some((m) => m.businessId === businessId);
  if (!allowed) fail("/biz", "You do not have access to that business.");
  (await cookies()).set(BUSINESS_COOKIE, String(businessId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/biz");
}

/* ---------------------------------------------------------------- catalogue */

export async function createCategory(formData: FormData) {
  await handle(formData, "owner", ({ db, businessId, back, userId }) => {
    const name = text(formData.get("name"), 2, 40);
    if (!name) fail(back, "Give the category a name.");
    const exists = db.prepare("SELECT 1 FROM categories WHERE business_id = ? AND name = ?").get(businessId, name);
    if (exists) fail(back, "That category already exists.");
    const sortOrder = positiveInt(formData.get("sortOrder"), 999) ?? 0;
    db.prepare("INSERT INTO categories (business_id, name, sort_order) VALUES (?, ?, ?)").run(businessId, name, sortOrder);
    audit(db, userId, "category.created", "business", businessId, { name });
  });
  revalidatePath("/biz/menu");
}

export async function deleteCategory(formData: FormData) {
  await handle(formData, "owner", ({ db, businessId, back, userId }) => {
    const id = positiveInt(formData.get("id"));
    if (!id) fail(back, "Unknown category.");
    const used = db.prepare("SELECT COUNT(*) AS n FROM products WHERE category_id = ? AND business_id = ? AND archived = 0").get(id, businessId) as { n: number };
    if (used.n > 0) fail(back, "Move or archive the products in that category first.");
    const result = db.prepare("DELETE FROM categories WHERE id = ? AND business_id = ?").run(id, businessId);
    if (!result.changes) fail(back, "Unknown category.");
    audit(db, userId, "category.deleted", "business", businessId, { id });
  });
  revalidatePath("/biz/menu");
}

function productInput(formData: FormData) {
  const name = text(formData.get("name"), 2, 80);
  const pricePaise = toPaise(formData.get("price"));
  const description = optionalText(formData.get("description"), 240);
  const overrideRaw = String(formData.get("pointsOverride") ?? "").trim();
  const pointsOverride = overrideRaw === "" ? null : Number(overrideRaw);
  if (!name) throw new DomainError("Enter a product name.");
  if (!pricePaise) throw new DomainError("Enter a valid price, for example 250 or 249.50.");
  if (pointsOverride !== null && (!Number.isInteger(pointsOverride) || pointsOverride < 0 || pointsOverride > 5_000)) {
    throw new DomainError("Product points must be a whole number between 0 and 5,000.");
  }
  return { name, pricePaise, description, pointsOverride };
}

export async function createProduct(formData: FormData) {
  await handle(formData, "owner", (ctx) => {
    try {
      const input = productInput(formData);
      const categoryId = positiveInt(formData.get("categoryId"));
      if (categoryId) {
        const owned = ctx.db.prepare("SELECT 1 FROM categories WHERE id = ? AND business_id = ?").get(categoryId, ctx.businessId);
        if (!owned) throw new DomainError("Choose one of your own categories.");
      }
      ctx.db
        .prepare("INSERT INTO products (business_id, category_id, name, description, price_paise, points_override) VALUES (?, ?, ?, ?, ?, ?)")
        .run(ctx.businessId, categoryId, input.name, input.description, input.pricePaise, input.pointsOverride);
      audit(ctx.db, ctx.userId, "product.created", "business", ctx.businessId, { name: input.name, pricePaise: input.pricePaise });
    } catch (error) {
      if (error instanceof DomainError) fail(ctx.back, error.message);
      throw error;
    }
  });
  revalidatePath("/biz/menu");
}

export async function updateProduct(formData: FormData) {
  await handle(formData, "owner", (ctx) => {
    try {
      const id = positiveInt(formData.get("id"));
      if (!id) throw new DomainError("Unknown product.");
      const input = productInput(formData);
      const categoryId = positiveInt(formData.get("categoryId"));
      if (categoryId) {
        const owned = ctx.db.prepare("SELECT 1 FROM categories WHERE id = ? AND business_id = ?").get(categoryId, ctx.businessId);
        if (!owned) throw new DomainError("Choose one of your own categories.");
      }
      const updated = ctx.db
        .prepare("UPDATE products SET name = ?, description = ?, price_paise = ?, points_override = ?, category_id = ? WHERE id = ? AND business_id = ?")
        .run(input.name, input.description, input.pricePaise, input.pointsOverride, categoryId, id, ctx.businessId);
      if (!updated.changes) throw new DomainError("Product not found.");
      audit(ctx.db, ctx.userId, "product.updated", "business", ctx.businessId, { id, pricePaise: input.pricePaise });
    } catch (error) {
      if (error instanceof DomainError) fail(ctx.back, error.message);
      throw error;
    }
  });
  revalidatePath("/biz/menu");
}

export async function toggleProduct(formData: FormData) {
  await handle(formData, "owner", ({ db, businessId, back, userId }) => {
    const id = positiveInt(formData.get("id"));
    if (!id) fail(back, "Unknown product.");
    const row = db.prepare("SELECT available FROM products WHERE id = ? AND business_id = ?").get(id, businessId) as { available: number } | undefined;
    if (!row) fail(back, "Product not found.");
    db.prepare("UPDATE products SET available = ? WHERE id = ? AND business_id = ?").run(row.available ? 0 : 1, id, businessId);
    audit(db, userId, "product.availability", "business", businessId, { id, available: !row.available });
  });
  revalidatePath("/biz/menu");
}

export async function archiveProduct(formData: FormData) {
  await handle(formData, "owner", ({ db, businessId, back, userId }) => {
    const id = positiveInt(formData.get("id"));
    if (!id) fail(back, "Unknown product.");
    const result = db.prepare("UPDATE products SET archived = 1, available = 0 WHERE id = ? AND business_id = ?").run(id, businessId);
    if (!result.changes) fail(back, "Product not found.");
    audit(db, userId, "product.archived", "business", businessId, { id });
  });
  revalidatePath("/biz/menu");
}

/* ----------------------------------------------------------------- rewards */

export async function createReward(formData: FormData) {
  await handle(formData, "owner", (ctx) => {
    try {
      const name = text(formData.get("name"), 2, 80);
      const description = optionalText(formData.get("description"), 240);
      const pointsCost = positiveInt(formData.get("pointsCost"), 100_000);
      if (!name) throw new DomainError("Name the reward.");
      if (!pointsCost) throw new DomainError("Set how many points the reward costs.");
      const stockRaw = String(formData.get("stock") ?? "").trim();
      const stock = stockRaw === "" ? null : Number(stockRaw);
      if (stock !== null && (!Number.isInteger(stock) || stock < 0)) throw new DomainError("Stock must be a whole number, or left empty.");
      const limitRaw = String(formData.get("perCustomerLimit") ?? "").trim();
      const limit = limitRaw === "" ? null : Number(limitRaw);
      if (limit !== null && (!Number.isInteger(limit) || limit < 1)) throw new DomainError("Per-customer limit must be 1 or more, or empty.");
      const validUntil = optionalText(formData.get("validUntil"), 10);
      if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) throw new DomainError("Enter a valid end date.");
      ctx.db
        .prepare(
          `INSERT INTO rewards (business_id, name, description, points_cost, stock, per_customer_limit, valid_until)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(ctx.businessId, name, description, pointsCost, stock, limit, validUntil);
      audit(ctx.db, ctx.userId, "reward.created", "business", ctx.businessId, { name, pointsCost });
    } catch (error) {
      if (error instanceof DomainError) fail(ctx.back, error.message);
      throw error;
    }
  });
  revalidatePath("/biz/rewards");
}

export async function updateReward(formData: FormData) {
  await handle(formData, "owner", (ctx) => {
    try {
      const id = positiveInt(formData.get("id"));
      const name = text(formData.get("name"), 2, 80);
      const pointsCost = positiveInt(formData.get("pointsCost"), 100_000);
      if (!id) throw new DomainError("Unknown reward.");
      if (!name) throw new DomainError("Name the reward.");
      if (!pointsCost) throw new DomainError("Set the points cost.");
      const result = ctx.db
        .prepare("UPDATE rewards SET name = ?, description = ?, points_cost = ? WHERE id = ? AND business_id = ?")
        .run(name, optionalText(formData.get("description"), 240), pointsCost, id, ctx.businessId);
      if (!result.changes) throw new DomainError("Reward not found.");
      audit(ctx.db, ctx.userId, "reward.updated", "business", ctx.businessId, { id, pointsCost });
    } catch (error) {
      if (error instanceof DomainError) fail(ctx.back, error.message);
      throw error;
    }
  });
  revalidatePath("/biz/rewards");
}

export async function toggleReward(formData: FormData) {
  await handle(formData, "owner", ({ db, businessId, back, userId }) => {
    const id = positiveInt(formData.get("id"));
    if (!id) fail(back, "Unknown reward.");
    const row = db.prepare("SELECT active FROM rewards WHERE id = ? AND business_id = ?").get(id, businessId) as { active: number } | undefined;
    if (!row) fail(back, "Reward not found.");
    db.prepare("UPDATE rewards SET active = ? WHERE id = ? AND business_id = ?").run(row.active ? 0 : 1, id, businessId);
    audit(db, userId, "reward.toggled", "business", businessId, { id, active: !row.active });
  });
  revalidatePath("/biz/rewards");
}

/* ----------------------------------------------------------------- loyalty */

export async function updateLoyalty(formData: FormData) {
  await handle(formData, "owner", (ctx) => {
    try {
      const pointsPer100 = Number(formData.get("pointsPer100"));
      const minPurchase = toPaise(formData.get("minPurchase")) ?? 0;
      const signupBonus = Number(formData.get("signupBonus"));
      const minRedeemPoints = Number(formData.get("minRedeemPoints"));
      const maxPointsPerTxn = Number(formData.get("maxPointsPerTxn"));
      if (!Number.isInteger(pointsPer100) || pointsPer100 < 0 || pointsPer100 > 1_000) throw new DomainError("Points per ₹100 must be between 0 and 1,000.");
      if (!Number.isInteger(signupBonus) || signupBonus < 0 || signupBonus > 10_000) throw new DomainError("Welcome points must be between 0 and 10,000.");
      if (!Number.isInteger(minRedeemPoints) || minRedeemPoints < 0 || minRedeemPoints > 100_000) throw new DomainError("Minimum redemption must be between 0 and 100,000.");
      if (!Number.isInteger(maxPointsPerTxn) || maxPointsPerTxn < 1 || maxPointsPerTxn > 100_000) throw new DomainError("The per-purchase cap must be between 1 and 100,000.");
      if (minPurchase > 2_000_000) throw new DomainError("The minimum purchase is too high.");
      ctx.db
        .prepare(
          `UPDATE businesses SET points_per_100 = ?, min_purchase_paise = ?, signup_bonus = ?,
                  min_redeem_points = ?, max_points_per_txn = ? WHERE id = ?`,
        )
        .run(pointsPer100, minPurchase, signupBonus, minRedeemPoints, maxPointsPerTxn, ctx.businessId);
      audit(ctx.db, ctx.userId, "loyalty.updated", "business", ctx.businessId, {
        pointsPer100, minPurchase, signupBonus, minRedeemPoints, maxPointsPerTxn,
      });
    } catch (error) {
      if (error instanceof DomainError) fail(ctx.back, error.message);
      throw error;
    }
  });
  revalidatePath("/biz/loyalty");
  revalidatePath("/biz");
}

export async function updateBusiness(formData: FormData) {
  await handle(formData, "owner", (ctx) => {
    try {
      const name = text(formData.get("name"), 2, 80);
      const category = text(formData.get("category"), 2, 40) ?? "Cafe";
      const brandColor = String(formData.get("brandColor") ?? "");
      if (!name) throw new DomainError("Enter the business name.");
      if (!/^#[0-9a-f]{6}$/i.test(brandColor)) throw new DomainError("Choose a six-digit brand colour.");
      ctx.db
        .prepare("UPDATE businesses SET name = ?, category = ?, description = ?, city = ?, address = ?, phone = ?, brand_color = ? WHERE id = ?")
        .run(
          name,
          category,
          optionalText(formData.get("description"), 400),
          optionalText(formData.get("city"), 60),
          optionalText(formData.get("address"), 160),
          optionalText(formData.get("phone"), 20),
          brandColor.toLowerCase(),
          ctx.businessId,
        );
      audit(ctx.db, ctx.userId, "business.updated", "business", ctx.businessId, { name });
    } catch (error) {
      if (error instanceof DomainError) fail(ctx.back, error.message);
      throw error;
    }
  });
  revalidatePath("/biz/settings");
  revalidatePath("/biz");
}

/* ------------------------------------------------------------- transactions */

export async function recordSale(formData: FormData) {
  await handle(formData, "any", (ctx) => {
    try {
      const customerId = positiveInt(formData.get("customerId"));
      const amountPaise = toPaise(formData.get("amount"));
      const reference = optionalText(formData.get("reference"), 60);
      const idempotencyKey = text(formData.get("idempotencyKey"), 8, 100);
      if (!customerId) throw new DomainError("Choose the customer this purchase belongs to.");
      if (!amountPaise) throw new DomainError("Enter the bill amount, for example 480 or 480.50.");
      if (!idempotencyKey) throw new DomainError("Missing sale reference. Reload and try again.");
      const result = recordPurchase(ctx.db, {
        actorId: ctx.userId,
        businessId: ctx.businessId,
        customerId,
        amountPaise,
        reference,
        idempotencyKey,
      });
      redirect(
        `/biz/transactions?ok=${encodeURIComponent(
          result.duplicate
            ? "That sale was already recorded — no extra points were issued."
            : `${result.points} points issued. Customer balance: ${result.balance}.`,
        )}`,
      );
    } catch (error) {
      if (error instanceof DomainError) fail(ctx.back, error.message);
      throw error;
    }
  });
  revalidatePath("/biz");
}

export async function reverseSale(formData: FormData) {
  await handle(formData, "owner", (ctx) => {
    try {
      const purchaseId = positiveInt(formData.get("purchaseId"));
      const reason = text(formData.get("reason"), 3, 160) ?? "Reversal by owner";
      if (!purchaseId) throw new DomainError("Unknown purchase.");
      reversePurchase(ctx.db, { actorId: ctx.userId, businessId: ctx.businessId, purchaseId, reason });
      redirect("/biz/transactions?ok=" + encodeURIComponent("Purchase reversed and points removed."));
    } catch (error) {
      if (error instanceof DomainError) fail(ctx.back, error.message);
      throw error;
    }
  });
  revalidatePath("/biz/transactions");
}

export async function adjustCustomerPoints(formData: FormData) {
  await handle(formData, "owner", (ctx) => {
    try {
      const customerId = positiveInt(formData.get("customerId"));
      const delta = Number(formData.get("delta"));
      const reason = text(formData.get("reason"), 3, 160);
      if (!customerId) throw new DomainError("Choose a customer.");
      if (!reason) throw new DomainError("Explain the adjustment.");
      const result = adjustPoints(ctx.db, { actorId: ctx.userId, businessId: ctx.businessId, customerId, delta, reason });
      redirect(`/biz/customers/${customerId}?ok=${encodeURIComponent(`Points adjusted. New balance: ${result.balance}.`)}`);
    } catch (error) {
      if (error instanceof DomainError) fail(ctx.back, error.message);
      throw error;
    }
  });
  revalidatePath("/biz/customers");
}

export async function verifyVoucher(formData: FormData) {
  await handle(formData, "any", (ctx) => {
    try {
      const token = text(formData.get("token"), 4, 20);
      if (!token) throw new DomainError("Enter the code shown by the customer.");
      const result = verifyRedemption(ctx.db, { actorId: ctx.userId, businessId: ctx.businessId, token });
      redirect(
        `/biz/redemptions?ok=${encodeURIComponent(`${result.rewardName} redeemed for ${result.customerName}.`)}`,
      );
    } catch (error) {
      if (error instanceof DomainError) fail(ctx.back, error.message);
      throw error;
    }
  });
  revalidatePath("/biz/redemptions");
}

/* -------------------------------------------------------------------- team */

export async function inviteStaff(formData: FormData) {
  await handle(formData, "owner", (ctx) => {
    const raw = text(formData.get("email"), 5, 254)?.toLowerCase();
    if (!raw) fail(ctx.back, "Enter the email they used to sign up.");
    const person = ctx.db.prepare("SELECT id, name FROM users WHERE email = ?").get(raw) as { id: number; name: string } | undefined;
    if (!person) fail(ctx.back, "No Repeato account uses that email. Ask them to create a customer account first, then invite again.");
    if (person.id === ctx.userId) fail(ctx.back, "You are already on this team.");
    const inserted = ctx.db
      .prepare("INSERT OR IGNORE INTO business_members (user_id, business_id, role) VALUES (?, ?, 'staff')")
      .run(person.id, ctx.businessId);
    if (!inserted.changes) fail(ctx.back, "That person is already on this team.");
    ctx.db.prepare("INSERT INTO notifications (user_id, business_id, title, body) VALUES (?, ?, 'Team invitation', ?)").run(
      person.id,
      ctx.businessId,
      `You were added to the ${getBusiness(ctx.db, ctx.businessId)?.name ?? "business"} team. Open /biz to help at the counter.`,
    );
    audit(ctx.db, ctx.userId, "staff.invited", "business", ctx.businessId, { userId: person.id });
  });
  revalidatePath("/biz/team");
}

export async function removeStaff(formData: FormData) {
  await handle(formData, "owner", (ctx) => {
    const userId = positiveInt(formData.get("userId"));
    if (!userId) fail(ctx.back, "Unknown team member.");
    if (userId === ctx.userId) fail(ctx.back, "You cannot remove yourself.");
    const result = ctx.db
      .prepare("DELETE FROM business_members WHERE user_id = ? AND business_id = ? AND role = 'staff'")
      .run(userId, ctx.businessId);
    if (!result.changes) fail(ctx.back, "That team member could not be removed.");
    audit(ctx.db, ctx.userId, "staff.removed", "business", ctx.businessId, { userId });
  });
  revalidatePath("/biz/team");
}
