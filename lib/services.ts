import { randomInt } from "node:crypto";
import { calculatePoints, type PurchaseLine, type PointsResult } from "./points";
import { rulesFromBusiness, type Db, type Rules } from "./db";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function redemptionToken(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)];
  return out;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Row lock for the account being debited. SQLite serialises writers with
 * BEGIN IMMEDIATE, so only Postgres needs it; without it two concurrent
 * redemptions can both read the same balance and overdraw the account.
 */
async function lockAccount(tx: Db, businessId: number, customerId: number) {
  if (tx.engine !== "postgres") return;
  await tx
    .prepare("SELECT 1 FROM business_customers WHERE business_id = ? AND user_id = ? FOR UPDATE")
    .get(businessId, customerId);
}

export type BusinessRow = {
  id: number;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  brandColor: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  status: "pending" | "active" | "suspended";
  pointsPer100: number;
  minPurchasePaise: number;
  signupBonus: number;
  minRedeemPoints: number;
  maxPointsPerTxn: number;
};

const BUSINESS_SELECT = `id, name, slug, category, description, brand_color AS "brandColor", address, city, phone,
  status, points_per_100 AS "pointsPer100", min_purchase_paise AS "minPurchasePaise", signup_bonus AS "signupBonus",
  min_redeem_points AS "minRedeemPoints", max_points_per_txn AS "maxPointsPerTxn"`;

export async function getBusinessBySlug(db: Db, slug: string): Promise<BusinessRow | null> {
  return (await db.prepare(`SELECT ${BUSINESS_SELECT} FROM businesses WHERE slug = ?`).get<BusinessRow>(slug)) ?? null;
}

export async function getBusiness(db: Db, id: number): Promise<BusinessRow | null> {
  return (await db.prepare(`SELECT ${BUSINESS_SELECT} FROM businesses WHERE id = ?`).get<BusinessRow>(id)) ?? null;
}

export function rulesFor(business: BusinessRow): Rules {
  return rulesFromBusiness(business);
}

export async function memberRole(db: Db, userId: number, businessId: number): Promise<"owner" | "staff" | null> {
  const row = await db
    .prepare("SELECT role FROM business_members WHERE user_id = ? AND business_id = ?")
    .get<{ role: "owner" | "staff" }>(userId, businessId);
  return row?.role ?? null;
}

export async function requireMember(
  db: Db,
  userId: number,
  businessId: number,
  need: "owner" | "any" = "any",
): Promise<"owner" | "staff"> {
  const role = await memberRole(db, userId, businessId);
  if (!role) throw new DomainError("You do not have access to this business.", 403);
  if (need === "owner" && role !== "owner") throw new DomainError("Only the owner can do that.", 403);
  return role;
}

export async function getBalance(db: Db, businessId: number, customerId: number): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(delta), 0) AS balance FROM ledger WHERE business_id = ? AND customer_id = ?")
    .get<{ balance: number }>(businessId, customerId);
  return Number(row?.balance ?? 0);
}

export async function isCustomerOf(db: Db, businessId: number, userId: number): Promise<boolean> {
  return Boolean(await db.prepare("SELECT 1 FROM business_customers WHERE business_id = ? AND user_id = ?").get(businessId, userId));
}

export async function audit(
  db: Db,
  actorId: number | null,
  action: string,
  entity: string,
  entityId: string | number | null,
  meta?: unknown,
) {
  await db
    .prepare("INSERT INTO audit_log (actor_id, action, entity, entity_id, meta) VALUES (?, ?, ?, ?, ?)")
    .run(actorId, action, entity, entityId === null ? null : String(entityId), meta === undefined ? null : JSON.stringify(meta));
}

async function notify(db: Db, userId: number, businessId: number | null, title: string, body: string) {
  await db
    .prepare("INSERT INTO notifications (user_id, business_id, title, body) VALUES (?, ?, ?, ?)")
    .run(userId, businessId, title, body);
}

export async function joinBusiness(db: Db, userId: number, businessId: number) {
  return db.transaction(async (tx) => {
    const business = await getBusiness(tx, businessId);
    if (!business) throw new DomainError("That business no longer exists.", 404);
    if (business.status !== "active") throw new DomainError("This business is not accepting members right now.");

    const inserted = await tx
      .prepare("INSERT INTO business_customers (business_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
      .run(businessId, userId);
    if (inserted.changes === 0) return { joined: false, bonus: 0 };

    let bonus = 0;
    if (business.signupBonus > 0) {
      bonus = business.signupBonus;
      await tx
        .prepare("INSERT INTO ledger (business_id, customer_id, delta, kind, note) VALUES (?, ?, ?, 'bonus', 'Welcome bonus')")
        .run(businessId, userId, bonus);
    }
    await notify(tx, userId, businessId, `Welcome to ${business.name}`, bonus ? `Your ${bonus} welcome points are in your wallet.` : "You are now a member.");
    await audit(tx, userId, "customer.joined", "business", businessId, { bonus });
    return { joined: true, bonus };
  });
}

export type PurchaseInput = {
  actorId: number;
  businessId: number;
  customerId: number;
  amountPaise: number;
  lines?: PurchaseLine[];
  reference?: string | null;
  note?: string | null;
  idempotencyKey: string;
};

export type PurchaseOutcome = {
  purchaseId: number;
  points: number;
  balance: number;
  result: PointsResult;
  duplicate?: boolean;
};

export async function recordPurchase(db: Db, input: PurchaseInput): Promise<PurchaseOutcome> {
  await requireMember(db, input.actorId, input.businessId);
  const business = await getBusiness(db, input.businessId);
  if (!business) throw new DomainError("Business not found.", 404);
  if (business.status === "suspended") throw new DomainError("This business is suspended.", 403);
  if (!(await isCustomerOf(db, input.businessId, input.customerId))) {
    throw new DomainError("That customer is not a member of this business.");
  }
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new DomainError("Enter a valid purchase amount.");
  }
  if (input.amountPaise > 20_000_000) throw new DomainError("Purchases above ₹2,00,000 need a manual adjustment.");
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    throw new DomainError("Missing sale reference. Reload the page and try again.");
  }

  const lines = input.lines ?? [];
  if (lines.some((l) => l.quantity < 1 || l.quantity > 999 || l.unitPricePaise < 0)) {
    throw new DomainError("Check the item quantities and prices.");
  }
  if (lines.length) {
    const lineTotal = lines.reduce((sum, l) => sum + l.unitPricePaise * l.quantity, 0);
    if (lineTotal !== input.amountPaise) throw new DomainError("The item total does not match the purchase amount.");
  }

  const result = calculatePoints({ amountPaise: input.amountPaise, rules: rulesFor(business), lines });

  return db.transaction(async (tx): Promise<PurchaseOutcome> => {
    // Two submissions with the same key race here; the unique index decides and
    // the loser returns the winner's purchase instead of awarding twice.
    const existing = await tx
      .prepare("SELECT id, points_awarded AS points FROM purchases WHERE idempotency_key = ?")
      .get<{ id: number; points: number }>(input.idempotencyKey);
    if (existing) {
      return {
        purchaseId: existing.id,
        points: existing.points,
        balance: await getBalance(tx, input.businessId, input.customerId),
        result,
        duplicate: true,
      };
    }

    const purchaseId = await tx.insert(
      `INSERT INTO purchases (business_id, customer_id, staff_id, amount_paise, points_awarded, reference, note, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.businessId,
      input.customerId,
      input.actorId,
      input.amountPaise,
      result.points,
      input.reference?.trim() || null,
      input.note?.trim() || null,
      input.idempotencyKey,
    );

    if (result.points > 0) {
      await tx
        .prepare("INSERT INTO ledger (business_id, customer_id, purchase_id, delta, kind, note) VALUES (?, ?, ?, ?, 'earn', ?)")
        .run(input.businessId, input.customerId, purchaseId, result.points, input.reference?.trim() || "Purchase");
    }
    for (const [index, line] of lines.entries()) {
      // result.lines is built in submitted order, so index pairing stays correct
      // even when two lines share the same product name.
      const points = result.lines[index]?.points ?? 0;
      await tx
        .prepare(
          "INSERT INTO purchase_items (purchase_id, product_id, name, unit_price_paise, quantity, points) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(purchaseId, line.productId ?? null, line.name, line.unitPricePaise, line.quantity, points);
    }
    await notify(
      tx,
      input.customerId,
      input.businessId,
      result.points > 0 ? `+${result.points} points at ${business.name}` : `Purchase recorded at ${business.name}`,
      result.points > 0
        ? `You earned ${result.points} points. Keep going to unlock your next reward.`
        : "This purchase was below the minimum for points.",
    );
    await audit(tx, input.actorId, "purchase.verified", "purchase", purchaseId, {
      businessId: input.businessId,
      customerId: input.customerId,
      amountPaise: input.amountPaise,
      points: result.points,
    });

    return {
      purchaseId,
      points: result.points,
      balance: await getBalance(tx, input.businessId, input.customerId),
      result,
    };
  });
}

export async function reversePurchase(
  db: Db,
  input: { actorId: number; businessId: number; purchaseId: number; reason: string },
) {
  await requireMember(db, input.actorId, input.businessId, "owner");
  return db.transaction(async (tx) => {
    const purchase = await tx
      .prepare(
        `SELECT id, customer_id AS "customerId", points_awarded AS points, status
           FROM purchases WHERE id = ? AND business_id = ?`,
      )
      .get<{ id: number; customerId: number; points: number; status: string }>(input.purchaseId, input.businessId);
    if (!purchase) throw new DomainError("Purchase not found.", 404);
    if (purchase.status === "reversed") throw new DomainError("That purchase was already reversed.");

    // Guarded transition: two concurrent reversals, only one wins.
    const updated = await tx
      .prepare("UPDATE purchases SET status = 'reversed', reversed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'verified'")
      .run(purchase.id);
    if (updated.changes === 0) throw new DomainError("That purchase was already reversed.");

    if (purchase.points > 0) {
      await tx
        .prepare("INSERT INTO ledger (business_id, customer_id, purchase_id, delta, kind, note) VALUES (?, ?, ?, ?, 'reverse', ?)")
        .run(input.businessId, purchase.customerId, purchase.id, -purchase.points, input.reason);
    }
    await notify(tx, purchase.customerId, input.businessId, "Purchase reversed", input.reason);
    await audit(tx, input.actorId, "purchase.reversed", "purchase", purchase.id, { reason: input.reason });
    return { points: purchase.points };
  });
}

export async function redeemReward(db: Db, input: { customerId: number; businessId: number; rewardId: number }) {
  return db.transaction(async (tx) => {
    if (!(await isCustomerOf(tx, input.businessId, input.customerId))) {
      throw new DomainError("Join this business before redeeming.", 403);
    }
    await lockAccount(tx, input.businessId, input.customerId);

    const business = await getBusiness(tx, input.businessId);
    if (!business || business.status !== "active") throw new DomainError("This business is not accepting redemptions.");
    const reward = await tx
      .prepare(
        `SELECT id, name, points_cost AS "pointsCost", active, stock, per_customer_limit AS "perCustomerLimit",
                valid_until AS "validUntil"
           FROM rewards WHERE id = ? AND business_id = ?`,
      )
      .get<{ id: number; name: string; pointsCost: number; active: boolean; stock: number | null; perCustomerLimit: number | null; validUntil: string | null }>(
        input.rewardId,
        input.businessId,
      );
    if (!reward || !reward.active) throw new DomainError("That reward is not available.", 404);
    if (reward.validUntil && String(reward.validUntil).slice(0, 10) < today()) {
      throw new DomainError("That reward has expired.");
    }
    const balance = await getBalance(tx, input.businessId, input.customerId);
    if (balance < business.minRedeemPoints) {
      throw new DomainError(`Redemptions start at ${business.minRedeemPoints} points. You have ${balance}.`);
    }
    if (balance < reward.pointsCost) {
      throw new DomainError(`You need ${reward.pointsCost - balance} more points for this reward.`);
    }
    if (reward.perCustomerLimit) {
      const used = await tx
        .prepare("SELECT COUNT(*) AS n FROM redemptions WHERE reward_id = ? AND customer_id = ? AND status <> 'cancelled'")
        .get<{ n: number }>(reward.id, input.customerId);
      if (Number(used?.n ?? 0) >= reward.perCustomerLimit) {
        throw new DomainError("You have already claimed this reward the maximum number of times.");
      }
    }
    if (reward.stock !== null) {
      const stock = await tx.prepare("UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0").run(reward.id);
      if (stock.changes === 0) throw new DomainError("That reward just went out of stock.");
    }

    const token = redemptionToken();
    const redemptionId = await tx.insert(
      "INSERT INTO redemptions (business_id, customer_id, reward_id, points_spent, token, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      input.businessId,
      input.customerId,
      reward.id,
      reward.pointsCost,
      token,
      isoIn(14),
    );
    await tx
      .prepare("INSERT INTO ledger (business_id, customer_id, redemption_id, delta, kind, note) VALUES (?, ?, ?, ?, 'redeem', ?)")
      .run(input.businessId, input.customerId, redemptionId, -reward.pointsCost, reward.name);

    await notify(
      tx,
      input.customerId,
      input.businessId,
      `Reward ready: ${reward.name}`,
      `Show code ${token} at ${business.name}. It expires in 14 days.`,
    );
    await audit(tx, input.customerId, "reward.redeemed", "redemption", redemptionId, {
      rewardId: reward.id,
      points: reward.pointsCost,
    });
    return { redemptionId, token, rewardName: reward.name, points: reward.pointsCost, balance: balance - reward.pointsCost };
  });
}

export async function verifyRedemption(db: Db, input: { actorId: number; businessId: number; token: string }) {
  await requireMember(db, input.actorId, input.businessId);
  return db.transaction(async (tx) => {
    const token = input.token.trim().toUpperCase();
    const row = await tx
      .prepare(
        `SELECT r.id, r.status, r.points_spent AS points, r.customer_id AS "customerId",
                u.name AS "customerName", rw.name AS "rewardName",
                (r.expires_at > ?) AS live
           FROM redemptions r
           JOIN users u ON u.id = r.customer_id
           JOIN rewards rw ON rw.id = r.reward_id
          WHERE r.token = ? AND r.business_id = ?`,
      )
      .get<{ id: number; status: string; points: number; customerId: number; customerName: string; rewardName: string; live: boolean }>(
        new Date().toISOString(),
        token,
        input.businessId,
      );
    if (!row) throw new DomainError("That code does not belong to this business.");
    if (row.status === "redeemed") throw new DomainError("That reward has already been redeemed.");
    if (row.status === "cancelled") throw new DomainError("That redemption was cancelled.");
    if (!row.live) throw new DomainError("That code has expired. Ask the customer to contact support.");

    // One-time use is enforced by the WHERE clause, not by the read above.
    const updated = await tx
      .prepare(
        "UPDATE redemptions SET status = 'redeemed', redeemed_at = CURRENT_TIMESTAMP, redeemed_by = ? WHERE id = ? AND status = 'issued'",
      )
      .run(input.actorId, row.id);
    if (updated.changes === 0) throw new DomainError("That reward has already been redeemed.");

    await notify(tx, row.customerId, input.businessId, "Reward redeemed", `${row.rewardName} was redeemed at the counter.`);
    await audit(tx, input.actorId, "redemption.verified", "redemption", row.id, { token });
    return { customerName: row.customerName, rewardName: row.rewardName, points: row.points };
  });
}

export async function adjustPoints(
  db: Db,
  input: { actorId: number; businessId: number; customerId: number; delta: number; reason: string },
) {
  // Enforced here, not only by the server action, so every caller inherits the rule.
  await requireMember(db, input.actorId, input.businessId, "owner");
  if (!Number.isSafeInteger(input.delta) || input.delta === 0) throw new DomainError("Enter a non-zero whole number of points.");
  if (Math.abs(input.delta) > 10_000) throw new DomainError("Single adjustments are limited to 10,000 points.");
  if (!input.reason.trim()) throw new DomainError("A reason is required for an adjustment.");
  if (!(await isCustomerOf(db, input.businessId, input.customerId))) throw new DomainError("Customer is not a member of this business.");
  return db.transaction(async (tx) => {
    await lockAccount(tx, input.businessId, input.customerId);
    const balance = await getBalance(tx, input.businessId, input.customerId);
    if (balance + input.delta < 0) throw new DomainError("That adjustment would put the balance below zero.");
    await tx
      .prepare("INSERT INTO ledger (business_id, customer_id, delta, kind, note) VALUES (?, ?, ?, 'adjust', ?)")
      .run(input.businessId, input.customerId, input.delta, input.reason.trim());
    await notify(
      tx,
      input.customerId,
      input.businessId,
      "Points adjusted",
      `${input.delta > 0 ? "+" : ""}${input.delta} points: ${input.reason.trim()}`,
    );
    await audit(tx, input.actorId, "points.adjusted", "customer", input.customerId, { delta: input.delta, reason: input.reason });
    return { balance: balance + input.delta };
  });
}

export async function createBusiness(
  db: Db,
  input: { ownerId: number; name: string; category: string; city?: string; description?: string },
) {
  const name = input.name.trim();
  if (name.length < 2) throw new DomainError("Enter your business name.");
  const base = slugify(name) || `business-${Date.now()}`;
  return db.transaction(async (tx) => {
    let slug = base;
    let n = 1;
    while (await tx.prepare("SELECT 1 FROM businesses WHERE slug = ?").get(slug)) slug = `${base}-${++n}`;
    const businessId = await tx.insert(
      "INSERT INTO businesses (name, slug, category, city, description) VALUES (?, ?, ?, ?, ?)",
      name,
      slug,
      input.category || "Cafe",
      input.city?.trim() || null,
      input.description?.trim() || null,
    );
    await tx
      .prepare("INSERT INTO business_members (user_id, business_id, role) VALUES (?, ?, 'owner')")
      .run(input.ownerId, businessId);
    await audit(tx, input.ownerId, "business.created", "business", businessId, { name, slug });
    return { businessId, slug };
  });
}
