import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { recordPurchase, verifyRedemption, createBusiness, joinBusiness } from "../lib/services";
import { createPostgresDb } from "../lib/drivers/postgres";
import type { Db } from "../lib/db";

/**
 * Concurrency tests ensuring ledger serialization, idempotency,
 * and double-redemption protection against real concurrent requests on PostgreSQL.
 */
const url = process.env.PG_TEST_URL;
const enabled = Boolean(url);
const suite = enabled ? describe.sequential : describe.skip;

suite("concurrency & double-spend protections (PostgreSQL)", () => {
  let db: Db;
  let pool: pg.Pool;

  beforeAll(async () => {
    db = createPostgresDb(url);
    pool = new pg.Pool({ connectionString: url });
  });

  afterAll(async () => {
    await db.close();
    await pool.end();
  });

  it("prevents double-redemption when two requests race simultaneously with the same voucher token", async () => {
    // Dedicated connection for creating records in its own committed transaction
    const client = await pool.connect();
    let ownerId: number;
    let customerId: number;
    let businessId: number;
    let rewardId: number;
    const token = `RACE${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const rand = Math.random().toString(36).substring(7);
      const ownerRes = await client.query(
        `INSERT INTO users (email, name, password_hash, role) VALUES ('owner_${rand}@test.com', 'Owner Race', 'hash', 'owner') RETURNING id`
      );
      ownerId = ownerRes.rows[0].id;

      const custRes = await client.query(
        `INSERT INTO users (email, name, password_hash, role) VALUES ('cust_${rand}@test.com', 'Cust Race', 'hash', 'customer') RETURNING id`
      );
      customerId = custRes.rows[0].id;

      const biz = await createBusiness(db, {
        ownerId,
        name: `Race Cafe ${rand}`,
        category: "Cafe",
      });
      businessId = biz.businessId;

      const rewardRes = await client.query(
        "INSERT INTO rewards (business_id, name, points_cost, active) VALUES ($1, 'Free Coffee', 100, 1) RETURNING id",
        [businessId]
      );
      rewardId = rewardRes.rows[0].id;

      await client.query(
        `INSERT INTO redemptions (business_id, reward_id, customer_id, token, points_spent, status, issued_at, expires_at)
         VALUES ($1, $2, $3, $4, 100, 'issued', now(), now() + interval '1 day')`,
        [businessId, rewardId, customerId, token]
      );
    } finally {
      client.release();
    }

    // Race two verifyRedemption calls concurrently against PostgreSQL
    const results = await Promise.allSettled([
      verifyRedemption(db, { actorId: ownerId, businessId, token }),
      verifyRedemption(db, { actorId: ownerId, businessId, token }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one redemption must succeed; the second must be rejected
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason.message).toMatch(/already been redeemed|already used|invalid|expired/i);
    }
  });

  it("settles concurrent submissions of one idempotency key without double-awarding points", async () => {
    const client = await pool.connect();
    let ownerId: number;
    let customerId: number;
    let businessId: number;
    const rand = Math.random().toString(36).substring(7);

    try {
      const custRes = await client.query(
        `INSERT INTO users (email, name, password_hash, role) VALUES ('cust_idem_${rand}@test.com', 'Cust Idem', 'hash', 'customer') RETURNING id`
      );
      customerId = custRes.rows[0].id;

      const ownerRes = await client.query(
        `INSERT INTO users (email, name, password_hash, role) VALUES ('owner_idem_${rand}@test.com', 'Owner Idem', 'hash', 'owner') RETURNING id`
      );
      ownerId = ownerRes.rows[0].id;

      const biz = await createBusiness(db, {
        ownerId,
        name: `Idem Cafe ${rand}`,
        category: "Cafe",
      });
      businessId = biz.businessId;
    } finally {
      client.release();
    }

    // Join customer to business
    await joinCustomer(customerId, businessId);

    const idempotencyKey = `sale_concurrent_key_${rand}`;

    // Race 4 concurrent submissions of the same key
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        recordPurchase(db, {
          actorId: ownerId,
          businessId,
          customerId,
          amountPaise: 50000,
          idempotencyKey,
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{
      purchaseId: number;
      points: number;
      balance: number;
    }>[];

    // At least one succeeded
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    // All successful results must point to the EXACT same purchaseId and balance
    const purchaseIds = new Set(fulfilled.map((f) => f.value.purchaseId));
    expect(purchaseIds.size).toBe(1);

    // Customer balance must only reflect one purchase (welcome bonus 20 + 50 points = 70)
    expect(fulfilled[0].value.balance).toBe(70);
  });

  async function joinCustomer(customerId: number, businessId: number) {
    await joinBusiness(db, customerId, businessId);
  }
});
