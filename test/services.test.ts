import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../lib/db";
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

let db: Database.Database;
let ownerId: number;
let staffId: number;
let customerId: number;
let otherOwnerId: number;
let businessId: number;
let otherBusinessId: number;
let rewardId: number;
let key = 0;
const newKey = () => `test-key-${Date.now()}-${++key}`;

function addUser(email: string, role: "owner" | "staff" | "customer" | "admin") {
  const row = db
    .prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, 'x', ?)")
    .run(email, email.split("@")[0], role);
  return Number(row.lastInsertRowid);
}

function addBusiness(name: string, slug: string, owner: number, pointsPer100 = 10) {
  const row = db
    .prepare("INSERT INTO businesses (name, slug, points_per_100) VALUES (?, ?, ?)")
    .run(name, slug, pointsPer100);
  const id = Number(row.lastInsertRowid);
  db.prepare("INSERT INTO business_members (user_id, business_id, role) VALUES (?, ?, 'owner')").run(owner, id);
  return id;
}

beforeEach(() => {
  db = createTestDb();
  ownerId = addUser("owner@bluebird.test", "owner");
  staffId = addUser("staff@bluebird.test", "staff");
  customerId = addUser("customer@example.test", "customer");
  otherOwnerId = addUser("owner@urban.test", "owner");
  businessId = addBusiness("Bluebird Coffee", "bluebird-coffee", ownerId);
  otherBusinessId = addBusiness("Urban Brew", "urban-brew", otherOwnerId);
  db.prepare("INSERT INTO business_members (user_id, business_id, role) VALUES (?, ?, 'staff')").run(staffId, businessId);
  rewardId = Number(
    db
      .prepare("INSERT INTO rewards (business_id, name, points_cost) VALUES (?, 'Free coffee', 100)")
      .run(businessId).lastInsertRowid,
  );
});

afterEach(() => db.close());

describe("membership", () => {
  it("awards the welcome bonus once", () => {
    expect(joinBusiness(db, customerId, businessId)).toEqual({ joined: true, bonus: 20 });
    expect(joinBusiness(db, customerId, businessId)).toEqual({ joined: false, bonus: 0 });
    expect(getBalance(db, businessId, customerId)).toBe(20);
  });

  it("keeps balances isolated per business", () => {
    joinBusiness(db, customerId, businessId);
    joinBusiness(db, customerId, otherBusinessId);
    recordPurchase(db, {
      actorId: ownerId,
      businessId,
      customerId,
      amountPaise: 50_000,
      idempotencyKey: newKey(),
    });
    expect(getBalance(db, businessId, customerId)).toBe(70);
    expect(getBalance(db, otherBusinessId, customerId)).toBe(20);
  });
});

describe("purchase verification", () => {
  it("awards points from the server-side rule", () => {
    joinBusiness(db, customerId, businessId);
    const result = recordPurchase(db, {
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

  it("returns the original purchase for a repeated idempotency key", () => {
    joinBusiness(db, customerId, businessId);
    const key = newKey();
    const first = recordPurchase(db, { actorId: staffId, businessId, customerId, amountPaise: 50_000, idempotencyKey: key });
    const second = recordPurchase(db, { actorId: staffId, businessId, customerId, amountPaise: 50_000, idempotencyKey: key });
    expect(second.duplicate).toBe(true);
    expect(second.purchaseId).toBe(first.purchaseId);
    expect(getBalance(db, businessId, customerId)).toBe(70);
  });

  it("rejects staff from another business", () => {
    joinBusiness(db, customerId, businessId);
    expect(() =>
      recordPurchase(db, { actorId: otherOwnerId, businessId, customerId, amountPaise: 50_000, idempotencyKey: newKey() }),
    ).toThrowError(/access to this business/);
  });

  it("rejects a non-member customer", () => {
    expect(() =>
      recordPurchase(db, { actorId: staffId, businessId, customerId, amountPaise: 50_000, idempotencyKey: newKey() }),
    ).toThrowError(DomainError);
  });

  it("rejects item totals that do not match the amount", () => {
    joinBusiness(db, customerId, businessId);
    expect(() =>
      recordPurchase(db, {
        actorId: staffId,
        businessId,
        customerId,
        amountPaise: 50_000,
        lines: [{ name: "Latte", unitPricePaise: 20_000, quantity: 1 }],
        idempotencyKey: newKey(),
      }),
    ).toThrowError(/does not match/);
  });

  it("reverses points once, owner only", () => {
    joinBusiness(db, customerId, businessId);
    const purchase = recordPurchase(db, { actorId: staffId, businessId, customerId, amountPaise: 50_000, idempotencyKey: newKey() });
    expect(() =>
      reversePurchase(db, { actorId: staffId, businessId, purchaseId: purchase.purchaseId, reason: "test" }),
    ).toThrowError(/owner/);
    reversePurchase(db, { actorId: ownerId, businessId, purchaseId: purchase.purchaseId, reason: "Duplicate sale" });
    expect(getBalance(db, businessId, customerId)).toBe(20);
    expect(() =>
      reversePurchase(db, { actorId: ownerId, businessId, purchaseId: purchase.purchaseId, reason: "again" }),
    ).toThrowError(/already reversed/);
  });
});

describe("reward redemption", () => {
  function fund(points: number) {
    joinBusiness(db, customerId, businessId);
    adjustPoints(db, { actorId: ownerId, businessId, customerId, delta: points, reason: "Test funding" });
  }

  it("deducts points and issues a one-time token", () => {
    fund(200);
    const redeemed = redeemReward(db, { customerId, businessId, rewardId });
    expect(redeemed.balance).toBe(120);
    expect(redeemed.token).toHaveLength(8);
    const verified = verifyRedemption(db, { actorId: staffId, businessId, token: redeemed.token.toLowerCase() });
    expect(verified.rewardName).toBe("Free coffee");
    expect(() => verifyRedemption(db, { actorId: staffId, businessId, token: redeemed.token })).toThrowError(
      /already been redeemed/,
    );
  });

  it("blocks redemption below the business minimum", () => {
    joinBusiness(db, customerId, businessId);
    expect(() => redeemReward(db, { customerId, businessId, rewardId })).toThrowError(/Redemptions start at 100/);
  });

  it("blocks redemption when the reward costs more than the balance", () => {
    fund(150);
    const brunch = Number(
      db.prepare("INSERT INTO rewards (business_id, name, points_cost) VALUES (?, 'Weekend brunch', 500)")
        .run(businessId).lastInsertRowid,
    );
    expect(() => redeemReward(db, { customerId, businessId, rewardId: brunch })).toThrowError(/more points/);
  });

  it("blocks cross-business verification", () => {
    fund(200);
    const redeemed = redeemReward(db, { customerId, businessId, rewardId });
    expect(() => verifyRedemption(db, { actorId: otherOwnerId, businessId: otherBusinessId, token: redeemed.token })).toThrowError(
      /does not belong/,
    );
  });

  it("enforces per-customer limits and stock", () => {
    fund(500);
    db.prepare("UPDATE rewards SET per_customer_limit = 1 WHERE id = ?").run(rewardId);
    redeemReward(db, { customerId, businessId, rewardId });
    expect(() => redeemReward(db, { customerId, businessId, rewardId })).toThrowError(/maximum number of times/);

    const stockReward = Number(
      db.prepare("INSERT INTO rewards (business_id, name, points_cost, stock) VALUES (?, 'Last slice', 10, 0)")
        .run(businessId).lastInsertRowid,
    );
    expect(() => redeemReward(db, { customerId, businessId, rewardId: stockReward })).toThrowError(/out of stock/);
  });

  it("prevents adjustments from going below zero", () => {
    joinBusiness(db, customerId, businessId);
    expect(() =>
      adjustPoints(db, { actorId: ownerId, businessId, customerId, delta: -50, reason: "too much" }),
    ).toThrowError(/below zero/);
  });
});
