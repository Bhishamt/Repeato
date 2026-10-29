import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type Db } from "../lib/db";
import {
  adjustPoints,
  DomainError,
  getBalance,
  joinBusiness,
  recordPurchase,
  redeemReward,
  reversePurchase,
  verifyRedemption,
} from "../lib/services";

let db: Db;
let ownerId: number;
let staffId: number;
let customerId: number;
let otherOwnerId: number;
let businessId: number;
let otherBusinessId: number;
let rewardId: number;
let key = 0;
const newKey = () => `test-key-${Date.now()}-${++key}`;

async function addUser(email: string, role: "owner" | "staff" | "customer" | "admin") {
  return db.insert("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, 'x', ?)", email, email.split("@")[0], role);
}

async function addBusiness(name: string, slug: string, owner: number, pointsPer100 = 10) {
  const id = await db.insert("INSERT INTO businesses (name, slug, points_per_100) VALUES (?, ?, ?)", name, slug, pointsPer100);
  await db.prepare("INSERT INTO business_members (user_id, business_id, role) VALUES (?, ?, 'owner')").run(owner, id);
  return id;
}

beforeEach(async () => {
  db = createTestDb();
  ownerId = await addUser("owner@bluebird.test", "owner");
  staffId = await addUser("staff@bluebird.test", "staff");
  customerId = await addUser("customer@example.test", "customer");
  otherOwnerId = await addUser("owner@urban.test", "owner");
  businessId = await addBusiness("Bluebird Coffee", "bluebird-coffee", ownerId);
  otherBusinessId = await addBusiness("Urban Brew", "urban-brew", otherOwnerId);
  await db.prepare("INSERT INTO business_members (user_id, business_id, role) VALUES (?, ?, 'staff')").run(staffId, businessId);
  rewardId = await db.insert("INSERT INTO rewards (business_id, name, points_cost) VALUES (?, 'Free coffee', 100)", businessId);
});

afterEach(async () => {
  await db.close();
});

describe("membership", () => {
  it("awards the welcome bonus once", async () => {
    expect(await joinBusiness(db, customerId, businessId)).toEqual({ joined: true, bonus: 20 });
    expect(await joinBusiness(db, customerId, businessId)).toEqual({ joined: false, bonus: 0 });
    expect(await getBalance(db, businessId, customerId)).toBe(20);
  });

  it("keeps balances isolated per business", async () => {
    await joinBusiness(db, customerId, businessId);
    await joinBusiness(db, customerId, otherBusinessId);
    await recordPurchase(db, {
      actorId: ownerId,
      businessId,
      customerId,
      amountPaise: 50_000,
      idempotencyKey: newKey(),
    });
    expect(await getBalance(db, businessId, customerId)).toBe(70);
    expect(await getBalance(db, otherBusinessId, customerId)).toBe(20);
  });
});

describe("purchase verification", () => {
  it("awards points from the server-side rule", async () => {
    await joinBusiness(db, customerId, businessId);
    const result = await recordPurchase(db, {
      actorId: staffId,
      businessId,
      customerId,
      amountPaise: 50_000,
      idempotencyKey: newKey(),
    });
    expect(result.points).toBe(50);
    expect(result.balance).toBe(70);
    expect(result.duplicate).toBeUndefined();
  });

  it("returns the original purchase for a repeated idempotency key", async () => {
    await joinBusiness(db, customerId, businessId);
    const idempotencyKey = newKey();
    const first = await recordPurchase(db, { actorId: staffId, businessId, customerId, amountPaise: 50_000, idempotencyKey });
    const second = await recordPurchase(db, { actorId: staffId, businessId, customerId, amountPaise: 50_000, idempotencyKey });
    expect(second.duplicate).toBe(true);
    expect(second.purchaseId).toBe(first.purchaseId);
    expect(await getBalance(db, businessId, customerId)).toBe(70);
  });

  it("settles concurrent submissions of one idempotency key into a single award", async () => {
    await joinBusiness(db, customerId, businessId);
    const idempotencyKey = newKey();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        recordPurchase(db, { actorId: staffId, businessId, customerId, amountPaise: 50_000, idempotencyKey }),
      ),
    );
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(fulfilled.map((r) => (r as PromiseFulfilledResult<{ purchaseId: number }>).value.purchaseId));
    expect(ids.size).toBe(1);
    expect(await getBalance(db, businessId, customerId)).toBe(70);
  });

  it("rejects staff from another business", async () => {
    await joinBusiness(db, customerId, businessId);
    await expect(
      recordPurchase(db, { actorId: otherOwnerId, businessId, customerId, amountPaise: 50_000, idempotencyKey: newKey() }),
    ).rejects.toThrow(/access to this business/);
  });

  it("rejects a non-member customer", async () => {
    await expect(
      recordPurchase(db, { actorId: staffId, businessId, customerId, amountPaise: 50_000, idempotencyKey: newKey() }),
    ).rejects.toThrow(DomainError);
  });

  it("rejects item totals that do not match the amount", async () => {
    await joinBusiness(db, customerId, businessId);
    await expect(
      recordPurchase(db, {
        actorId: staffId,
        businessId,
        customerId,
        amountPaise: 50_000,
        lines: [{ name: "Latte", unitPricePaise: 20_000, quantity: 1 }],
        idempotencyKey: newKey(),
      }),
    ).rejects.toThrow(/does not match/);
  });

  it("records per-item points when two lines share the same name", async () => {
    await joinBusiness(db, customerId, businessId);
    const result = await recordPurchase(db, {
      actorId: staffId,
      businessId,
      customerId,
      amountPaise: 30_000,
      lines: [
        { name: "Latte", unitPricePaise: 15_000, quantity: 1 },
        { name: "Latte", unitPricePaise: 15_000, quantity: 1, pointsOverride: 30 },
      ],
      idempotencyKey: newKey(),
    });
    expect(result.points).toBe(45);
    const items = await db
      .prepare("SELECT points FROM purchase_items WHERE purchase_id = ? ORDER BY id")
      .all<{ points: number }>(result.purchaseId);
    expect(items.map((i) => i.points)).toEqual([15, 30]);
  });

  it("reverses points once, owner only", async () => {
    await joinBusiness(db, customerId, businessId);
    const purchase = await recordPurchase(db, { actorId: staffId, businessId, customerId, amountPaise: 50_000, idempotencyKey: newKey() });
    await expect(
      reversePurchase(db, { actorId: staffId, businessId, purchaseId: purchase.purchaseId, reason: "test" }),
    ).rejects.toThrow(/owner/);
    await reversePurchase(db, { actorId: ownerId, businessId, purchaseId: purchase.purchaseId, reason: "Duplicate sale" });
    expect(await getBalance(db, businessId, customerId)).toBe(20);
    await expect(
      reversePurchase(db, { actorId: ownerId, businessId, purchaseId: purchase.purchaseId, reason: "again" }),
    ).rejects.toThrow(/already reversed/);
  });
});

describe("reward redemption", () => {
  async function fund(points: number) {
    await joinBusiness(db, customerId, businessId);
    await adjustPoints(db, { actorId: ownerId, businessId, customerId, delta: points, reason: "Test funding" });
  }

  it("deducts points and issues a one-time token", async () => {
    await fund(200);
    const redeemed = await redeemReward(db, { customerId, businessId, rewardId });
    expect(redeemed.balance).toBe(120);
    expect(redeemed.token).toHaveLength(8);
    const verified = await verifyRedemption(db, { actorId: staffId, businessId, token: redeemed.token.toLowerCase() });
    expect(verified.rewardName).toBe("Free coffee");
    await expect(verifyRedemption(db, { actorId: staffId, businessId, token: redeemed.token })).rejects.toThrow(
      /already been redeemed/,
    );
  });

  it("accepts a voucher only once under concurrent verification", async () => {
    await fund(200);
    const redeemed = await redeemReward(db, { customerId, businessId, rewardId });
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => verifyRedemption(db, { actorId: staffId, businessId, token: redeemed.token })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("cannot double-spend the same balance concurrently", async () => {
    await fund(150);
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () => redeemReward(db, { customerId, businessId, rewardId })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await getBalance(db, businessId, customerId)).toBe(70);
  });

  it("blocks redemption below the business minimum", async () => {
    await joinBusiness(db, customerId, businessId);
    await expect(redeemReward(db, { customerId, businessId, rewardId })).rejects.toThrow(/Redemptions start at 100/);
  });

  it("blocks redemption when the reward costs more than the balance", async () => {
    await fund(150);
    const brunch = await db.insert("INSERT INTO rewards (business_id, name, points_cost) VALUES (?, 'Weekend brunch', 500)", businessId);
    await expect(redeemReward(db, { customerId, businessId, rewardId: brunch })).rejects.toThrow(/more points/);
  });

  it("blocks cross-business verification", async () => {
    await fund(200);
    const redeemed = await redeemReward(db, { customerId, businessId, rewardId });
    await expect(
      verifyRedemption(db, { actorId: otherOwnerId, businessId: otherBusinessId, token: redeemed.token }),
    ).rejects.toThrow(/does not belong/);
  });

  it("enforces per-customer limits and stock", async () => {
    await fund(500);
    await db.prepare("UPDATE rewards SET per_customer_limit = 1 WHERE id = ?").run(rewardId);
    await redeemReward(db, { customerId, businessId, rewardId });
    await expect(redeemReward(db, { customerId, businessId, rewardId })).rejects.toThrow(/maximum number of times/);

    const stockReward = await db.insert(
      "INSERT INTO rewards (business_id, name, points_cost, stock) VALUES (?, 'Last slice', 10, 0)",
      businessId,
    );
    await expect(redeemReward(db, { customerId, businessId, rewardId: stockReward })).rejects.toThrow(/out of stock/);
  });

  it("prevents adjustments from going below zero", async () => {
    await joinBusiness(db, customerId, businessId);
    await expect(
      adjustPoints(db, { actorId: ownerId, businessId, customerId, delta: -50, reason: "too much" }),
    ).rejects.toThrow(/below zero/);
  });
});

describe("point adjustments", () => {
  it("only the business owner may adjust points", async () => {
    await joinBusiness(db, customerId, businessId);
    await expect(
      adjustPoints(db, { actorId: staffId, businessId, customerId, delta: 50, reason: "Staff attempt" }),
    ).rejects.toThrow(/owner/);
    await expect(
      adjustPoints(db, { actorId: otherOwnerId, businessId, customerId, delta: 50, reason: "Cross-business" }),
    ).rejects.toThrow(/access to this business/);
    expect(await getBalance(db, businessId, customerId)).toBe(20);
    await adjustPoints(db, { actorId: ownerId, businessId, customerId, delta: 50, reason: "Owner adjustment" });
    expect(await getBalance(db, businessId, customerId)).toBe(70);
  });
});
