import type Database from "better-sqlite3";
import { randomInt } from "node:crypto";
import { calculatePoints, type PurchaseLine, type PointsResult } from "./points";
import { DEFAULT_RULES, rulesFromBusiness, type Rules } from "./db";

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

const BUSINESS_SELECT = `id, name, slug, category, description, brand_color AS brandColor, address, city, phone,
  status, points_per_100 AS pointsPer100, min_purchase_paise AS minPurchasePaise, signup_bonus AS signupBonus,
  min_redeem_points AS minRedeemPoints, max_points_per_txn AS maxPointsPerTxn`;

export function getBusinessBySlug(db: Database.Database, slug: string): BusinessRow | null {
  return (db.prepare(`SELECT ${BUSINESS_SELECT} FROM businesses WHERE slug = ?`).get(slug) as BusinessRow) ?? null;
}

export function getBusiness(db: Database.Database, id: number): BusinessRow | null {
  return (db.prepare(`SELECT ${BUSINESS_SELECT} FROM businesses WHERE id = ?`).get(id) as BusinessRow) ?? null;
}

export function rulesFor(business: BusinessRow): Rules {
  return rulesFromBusiness(business);
}

export function memberRole(
  db: Database.Database,
  userId: number,
  businessId: number,
): "owner" | "staff" | null {
  const row = db
    .prepare("SELECT role FROM business_members WHERE user_id = ? AND business_id = ?")
    .get(userId, businessId) as { role: "owner" | "staff" } | undefined;
  return row?.role ?? null;
}

export function requireMember(
  db: Database.Database,
  userId: number,
  businessId: number,
  need: "owner" | "any" = "any",
): "owner" | "staff" {
  const role = memberRole(db, userId, businessId);
  if (!role) throw new DomainError("You do not have access to this business.", 403);
  if (need === "owner" && role !== "owner") throw new DomainError("Only the owner can do that.", 403);
  return role;
}

export function getBalance(db: Database.Database, businessId: number, customerId: number): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(delta), 0) AS balance FROM ledger WHERE business_id = ? AND customer_id = ?")
    .get(businessId, customerId) as { balance: number };
  return row.balance;
}

export function isCustomerOf(db: Database.Database, businessId: number, userId: number): boolean {
  return Boolean(
    db.prepare("SELECT 1 FROM business_customers WHERE business_id = ? AND user_id = ?").get(businessId, userId),
  );
}

export function audit(db: Database.Database, actorId: number | null, action: string, entity: string, entityId: string | number | null, meta?: unknown) {
  db.prepare("INSERT INTO audit_log (actor_id, action, entity, entity_id, meta) VALUES (?, ?, ?, ?, ?)").run(
    actorId,
    action,
    entity,
    entityId === null ? null : String(entityId),
    meta === undefined ? null : JSON.stringify(meta),
  );
}

function notify(db: Database.Database, userId: number, businessId: number | null, title: string, body: string) {
  db.prepare("INSERT INTO notifications (user_id, business_id, title, body) VALUES (?, ?, ?, ?)").run(
    userId,
    businessId,
    title,
    body,
  );
}

export function joinBusiness(db: Database.Database, userId: number, businessId: number) {
  return db.transaction(() => {
    const business = getBusiness(db, businessId);
    if (!business) throw new DomainError("That business no longer exists.", 404);
    if (business.status !== "active") throw new DomainError("This business is not accepting members right now.");

    const inserted = db
      .prepare("INSERT OR IGNORE INTO business_customers (business_id, user_id) VALUES (?, ?)")
      .run(businessId, userId);
    if (inserted.changes === 0) return { joined: false, bonus: 0 };

    let bonus = 0;
    if (business.signupBonus > 0) {
      bonus = business.signupBonus;
      db.prepare(
        "INSERT INTO ledger (business_id, customer_id, delta, kind, note) VALUES (?, ?, ?, 'bonus', 'Welcome bonus')",
      ).run(businessId, userId, bonus);
    }
    notify(db, userId, businessId, `Welcome to ${business.name}`, bonus ? `Your ${bonus} welcome points are in your wallet.` : "You are now a member.");
    audit(db, userId, "customer.joined", "business", businessId, { bonus });
    return { joined: true, bonus };
  }).immediate();
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

export function previewPurchase(
  db: Database.Database,
  businessId: number,
  amountPaise: number,
  lines: PurchaseLine[] = [],
) {
  const business = getBusiness(db, businessId);
  const rules = business ? rulesFor(business) : DEFAULT_RULES;
  return calculatePoints({ amountPaise, rules, lines });
}

export function recordPurchase(db: Database.Database, input: PurchaseInput): PurchaseOutcome {
  requireMember(db, input.actorId, input.businessId);
  const business = getBusiness(db, input.businessId);
  if (!business) throw new DomainError("Business not found.", 404);
  if (business.status === "suspended") throw new DomainError("This business is suspended.", 403);
  if (!isCustomerOf(db, input.businessId, input.customerId)) {
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

  return db.transaction((): PurchaseOutcome => {
    const existing = db
      .prepare("SELECT id, points_awarded FROM purchases WHERE idempotency_key = ?")
      .get(input.idempotencyKey) as { id: number; points_awarded: number } | undefined;
    if (existing) {
      return {
        purchaseId: existing.id,
        points: existing.points_awarded,
        balance: getBalance(db, input.businessId, input.customerId),
        result,
        duplicate: true,
      };
    }

    const purchase = db
      .prepare(
        `INSERT INTO purchases (business_id, customer_id, staff_id, amount_paise, points_awarded, reference, note, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.businessId,
        input.customerId,
        input.actorId,
        input.amountPaise,
        result.points,
        input.reference?.trim() || null,
        input.note?.trim() || null,
        input.idempotencyKey,
      );
    const purchaseId = Number(purchase.lastInsertRowid);

    if (result.points > 0) {
      db.prepare(
        "INSERT INTO ledger (business_id, customer_id, purchase_id, delta, kind, note) VALUES (?, ?, ?, ?, 'earn', ?)",
      ).run(input.businessId, input.customerId, purchaseId, result.points, input.reference?.trim() || "Purchase");
    }
    for (const line of lines) {
      const points = result.lines.find((l) => l.name === line.name)?.points ?? 0;
      db.prepare(
        "INSERT INTO purchase_items (purchase_id, product_id, name, unit_price_paise, quantity, points) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(purchaseId, line.productId ?? null, line.name, line.unitPricePaise, line.quantity, points);
    }
    notify(
      db,
      input.customerId,
      input.businessId,
      result.points > 0 ? `+${result.points} points at ${business.name}` : `Purchase recorded at ${business.name}`,
      result.points > 0
        ? `You earned ${result.points} points. Keep going to unlock your next reward.`
        : "This purchase was below the minimum for points.",
    );
    audit(db, input.actorId, "purchase.verified", "purchase", purchaseId, {
      businessId: input.businessId,
      customerId: input.customerId,
      amountPaise: input.amountPaise,
      points: result.points,
    });

    return {
      purchaseId,
      points: result.points,
      balance: getBalance(db, input.businessId, input.customerId),
      result,
    };
  }).immediate();
}

export function reversePurchase(
  db: Database.Database,
  input: { actorId: number; businessId: number; purchaseId: number; reason: string },
) {
  requireMember(db, input.actorId, input.businessId, "owner");
  return db.transaction(() => {
    const purchase = db
      .prepare(
        "SELECT id, customer_id AS customerId, points_awarded AS points, status FROM purchases WHERE id = ? AND business_id = ?",
      )
      .get(input.purchaseId, input.businessId) as
      | { id: number; customerId: number; points: number; status: string }
      | undefined;
    if (!purchase) throw new DomainError("Purchase not found.", 404);
    if (purchase.status === "reversed") throw new DomainError("That purchase was already reversed.");

    const updated = db
      .prepare("UPDATE purchases SET status = 'reversed', reversed_at = datetime('now') WHERE id = ? AND status = 'verified'")
      .run(purchase.id);
    if (updated.changes === 0) throw new DomainError("That purchase was already reversed.");

    if (purchase.points > 0) {
      db.prepare(
        "INSERT INTO ledger (business_id, customer_id, purchase_id, delta, kind, note) VALUES (?, ?, ?, ?, 'reverse', ?)",
      ).run(input.businessId, purchase.customerId, purchase.id, -purchase.points, input.reason);
    }
    notify(db, purchase.customerId, input.businessId, "Purchase reversed", input.reason);
    audit(db, input.actorId, "purchase.reversed", "purchase", purchase.id, { reason: input.reason });
    return { points: purchase.points };
  }).immediate();
}

export function redeemReward(
  db: Database.Database,
  input: { customerId: number; businessId: number; rewardId: number },
) {
  return db.transaction(() => {
    if (!isCustomerOf(db, input.businessId, input.customerId)) {
      throw new DomainError("Join this business before redeeming.", 403);
    }
    const business = getBusiness(db, input.businessId);
    if (!business || business.status !== "active") throw new DomainError("This business is not accepting redemptions.");
    const reward = db
      .prepare(
        `SELECT id, name, points_cost AS pointsCost, active, stock, per_customer_limit AS perCustomerLimit, valid_until AS validUntil
           FROM rewards WHERE id = ? AND business_id = ?`,
      )
      .get(input.rewardId, input.businessId) as
      | { id: number; name: string; pointsCost: number; active: number; stock: number | null; perCustomerLimit: number | null; validUntil: string | null }
      | undefined;
    if (!reward || !reward.active) throw new DomainError("That reward is not available.", 404);
    if (reward.validUntil && reward.validUntil < new Date().toISOString().slice(0, 10)) {
      throw new DomainError("That reward has expired.");
    }
    const balance = getBalance(db, input.businessId, input.customerId);
    if (balance < business.minRedeemPoints) {
      throw new DomainError(`Redemptions start at ${business.minRedeemPoints} points. You have ${balance}.`);
    }
    if (balance < reward.pointsCost) {
      throw new DomainError(`You need ${reward.pointsCost - balance} more points for this reward.`);
    }
    if (reward.perCustomerLimit) {
      const used = db
        .prepare("SELECT COUNT(*) AS n FROM redemptions WHERE reward_id = ? AND customer_id = ? AND status <> 'cancelled'")
        .get(reward.id, input.customerId) as { n: number };
      if (used.n >= reward.perCustomerLimit) throw new DomainError("You have already claimed this reward the maximum number of times.");
    }
    if (reward.stock !== null) {
      const stock = db.prepare("UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0").run(reward.id);
      if (stock.changes === 0) throw new DomainError("That reward just went out of stock.");
    }

    const token = redemptionToken();
    const redemption = db
      .prepare(
        `INSERT INTO redemptions (business_id, customer_id, reward_id, points_spent, token, expires_at)
         VALUES (?, ?, ?, ?, ?, datetime('now', '+14 days'))`,
      )
      .run(input.businessId, input.customerId, reward.id, reward.pointsCost, token);
    const redemptionId = Number(redemption.lastInsertRowid);
    db.prepare(
      "INSERT INTO ledger (business_id, customer_id, redemption_id, delta, kind, note) VALUES (?, ?, ?, ?, 'redeem', ?)",
    ).run(input.businessId, input.customerId, redemptionId, -reward.pointsCost, reward.name);

    notify(
      db,
      input.customerId,
      input.businessId,
      `Reward ready: ${reward.name}`,
      `Show code ${token} at ${business.name}. It expires in 14 days.`,
    );
    audit(db, input.customerId, "reward.redeemed", "redemption", redemptionId, {
      rewardId: reward.id,
      points: reward.pointsCost,
    });
    return { redemptionId, token, rewardName: reward.name, points: reward.pointsCost, balance: balance - reward.pointsCost };
  }).immediate();
}

export function verifyRedemption(
  db: Database.Database,
  input: { actorId: number; businessId: number; token: string },
) {
  requireMember(db, input.actorId, input.businessId);
  return db.transaction(() => {
    const token = input.token.trim().toUpperCase();
    const row = db
      .prepare(
        `SELECT r.id, r.status, r.expires_at AS expiresAt, r.points_spent AS points, r.customer_id AS customerId,
                u.name AS customerName, rw.name AS rewardName
           FROM redemptions r
           JOIN users u ON u.id = r.customer_id
           JOIN rewards rw ON rw.id = r.reward_id
          WHERE r.token = ? AND r.business_id = ?`,
      )
      .get(token, input.businessId) as
      | { id: number; status: string; expiresAt: string; points: number; customerId: number; customerName: string; rewardName: string }
      | undefined;
    if (!row) throw new DomainError("That code does not belong to this business.");
    if (row.status === "redeemed") throw new DomainError("That reward has already been redeemed.");
    if (row.status === "cancelled") throw new DomainError("That redemption was cancelled.");
    if (row.expiresAt < new Date().toISOString().slice(0, 19).replace("T", " ")) {
      throw new DomainError("That code has expired. Ask the customer to contact support.");
    }

    const updated = db
      .prepare("UPDATE redemptions SET status = 'redeemed', redeemed_at = datetime('now'), redeemed_by = ? WHERE id = ? AND status = 'issued'")
      .run(input.actorId, row.id);
    if (updated.changes === 0) throw new DomainError("That reward has already been redeemed.");

    notify(db, row.customerId, input.businessId, "Reward redeemed", `${row.rewardName} was redeemed at the counter.`);
    audit(db, input.actorId, "redemption.verified", "redemption", row.id, { token });
    return { customerName: row.customerName, rewardName: row.rewardName, points: row.points };
  }).immediate();
}

export function adjustPoints(
  db: Database.Database,
  input: { actorId: number; businessId: number; customerId: number; delta: number; reason: string },
) {
  if (!Number.isSafeInteger(input.delta) || input.delta === 0) throw new DomainError("Enter a non-zero whole number of points.");
  if (Math.abs(input.delta) > 10_000) throw new DomainError("Single adjustments are limited to 10,000 points.");
  if (!input.reason.trim()) throw new DomainError("A reason is required for an adjustment.");
  if (!isCustomerOf(db, input.businessId, input.customerId)) throw new DomainError("Customer is not a member of this business.");
  return db.transaction(() => {
    const balance = getBalance(db, input.businessId, input.customerId);
    if (balance + input.delta < 0) throw new DomainError("That adjustment would put the balance below zero.");
    db.prepare(
      "INSERT INTO ledger (business_id, customer_id, delta, kind, note) VALUES (?, ?, ?, 'adjust', ?)",
    ).run(input.businessId, input.customerId, input.delta, input.reason.trim());
    notify(db, input.customerId, input.businessId, "Points adjusted", `${input.delta > 0 ? "+" : ""}${input.delta} points: ${input.reason.trim()}`);
    audit(db, input.actorId, "points.adjusted", "customer", input.customerId, { delta: input.delta, reason: input.reason });
    return { balance: balance + input.delta };
  }).immediate();
}

export function createBusiness(
  db: Database.Database,
  input: { ownerId: number; name: string; category: string; city?: string; description?: string },
) {
  const name = input.name.trim();
  if (name.length < 2) throw new DomainError("Enter your business name.");
  const base = slugify(name) || `business-${Date.now()}`;
  return db.transaction(() => {
    let slug = base;
    let n = 1;
    while (db.prepare("SELECT 1 FROM businesses WHERE slug = ?").get(slug)) slug = `${base}-${++n}`;
    const biz = db
      .prepare("INSERT INTO businesses (name, slug, category, city, description) VALUES (?, ?, ?, ?, ?)")
      .run(name, slug, input.category || "Cafe", input.city?.trim() || null, input.description?.trim() || null);
    const businessId = Number(biz.lastInsertRowid);
    db.prepare("INSERT INTO business_members (user_id, business_id, role) VALUES (?, ?, 'owner')").run(input.ownerId, businessId);
    audit(db, input.ownerId, "business.created", "business", businessId, { name, slug });
    return { businessId, slug };
  }).immediate();
}
