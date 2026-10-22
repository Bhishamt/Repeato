import { afterAll, beforeAll, describe, expect, test } from "vitest";
import pg from "pg";

/**
 * Row level security, executed against a real PostgreSQL server.
 *
 * Enable with PG_TEST_URL (the local cluster from `npm run db:start`):
 *   PG_TEST_URL=postgres://postgres@127.0.0.1:55432/repeato_test npm test
 *
 * Every assertion impersonates a browser client: `set local role authenticated`
 * plus a JWT claim, exactly as PostgREST does for a signed-in user. The outer
 * transaction is always rolled back, so the fixture never survives the run.
 */
const url = process.env.PG_TEST_URL;
const enabled = Boolean(url);
const suite = enabled ? describe.sequential : describe.skip;

const ids = {
  ownerA: 0,
  staffA: 0,
  ownerB: 0,
  customerA: 0,
  customerB: 0,
  admin: 0,
  businessA: 0,
  businessB: 0,
  suspended: 0,
};

let client: pg.Client;

async function asUser<T>(userId: number | null, fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    if (userId !== null) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: String(userId) })]);
    }
    return await fn((sql, params) => client.query(sql, params));
  } finally {
    await client.query("rollback");
  }
}

const count = async (sql: string, params?: unknown[]) => Number((await client.query(sql, params)).rows[0].n);

suite("row level security (live PostgreSQL)", () => {
  beforeAll(async () => {
    client = new pg.Client({ connectionString: url });
    await client.connect();
    const { rows } = await client.query("select current_database() as db");
    if (!/_test$/.test(rows[0].db)) throw new Error(`refusing to run RLS fixture against ${rows[0].db}`);

    await client.query(`
      truncate ledger, purchase_items, purchases, redemptions, notifications, audit_log,
               rewards, products, categories, business_customers, business_members,
               businesses, sessions, users restart identity cascade
    `);

    const user = async (email: string, name: string, role: string) =>
      Number(
        (await client.query("insert into users (email, name, password_hash, role) values ($1,$2,'x',$3) returning id", [email, name, role]))
          .rows[0].id,
      );

    ids.ownerA = await user("rls-owner-a@test.local", "Owner A", "owner");
    ids.staffA = await user("rls-staff-a@test.local", "Staff A", "staff");
    ids.ownerB = await user("rls-owner-b@test.local", "Owner B", "owner");
    ids.customerA = await user("rls-customer-a@test.local", "Customer A", "customer");
    ids.customerB = await user("rls-customer-b@test.local", "Customer B", "customer");
    ids.admin = await user("rls-admin@test.local", "Admin", "admin");

    const business = async (slug: string, status: string) =>
      Number(
        (await client.query("insert into businesses (name, slug, category, status) values ($1,$1,$2,$3) returning id", [slug, "Cafe", status]))
          .rows[0].id,
      );

    ids.businessA = await business("rls-a", "active");
    ids.businessB = await business("rls-b", "active");
    ids.suspended = await business("rls-suspended", "suspended");

    await client.query("insert into business_members (user_id, business_id, role) values ($1,$2,'owner'), ($3,$2,'staff'), ($4,$5,'owner')", [
      ids.ownerA,
      ids.businessA,
      ids.staffA,
      ids.ownerB,
      ids.businessB,
    ]);
    await client.query("insert into business_customers (business_id, user_id) values ($1,$2), ($3,$4)", [
      ids.businessA,
      ids.customerA,
      ids.businessB,
      ids.customerB,
    ]);
    await client.query("insert into ledger (business_id, customer_id, delta, kind) values ($1,$2,100,'earn'), ($3,$4,50,'earn')", [
      ids.businessA,
      ids.customerA,
      ids.businessB,
      ids.customerB,
    ]);
    await client.query(
      "insert into purchases (business_id, customer_id, staff_id, amount_paise, points_awarded, idempotency_key) values ($1,$2,$3,50000,100,'rls-1'), ($4,$5,$6,30000,50,'rls-2')",
      [ids.businessA, ids.customerA, ids.staffA, ids.businessB, ids.customerB, ids.ownerB],
    );
    await client.query("insert into audit_log (actor_id, action, entity) values ($1,'test','business')", [ids.ownerA]);
    await client.query("insert into sessions (token_hash, user_id, expires_at) values ('rls-hash',$1, now() + interval '1 day')", [ids.customerA]);
  });

  afterAll(async () => {
    await client?.end();
  });

  test("a signed-out browser reads the public directory only", async () => {
    const visible = await asUser(null, async (q) => (await q("select slug from businesses order by slug")).rows.map((r) => r.slug));
    expect(visible).toEqual(["rls-a", "rls-b"]);
    expect(await asUser(null, () => count("select count(*) as n from users"))).toBe(0);
    expect(await asUser(null, () => count("select count(*) as n from ledger"))).toBe(0);
    expect(await asUser(null, () => count("select count(*) as n from sessions"))).toBe(0);
  });

  test("a customer sees their own ledger, purchases and nothing from another business", async () => {
    expect(await asUser(ids.customerA, () => count("select count(*) as n from ledger"))).toBe(1);
    expect(await asUser(ids.customerA, () => count("select count(*) as n from ledger where business_id = $1", [ids.businessA]))).toBe(1);
    expect(await asUser(ids.customerA, () => count("select count(*) as n from purchases"))).toBe(1);
    expect(await asUser(ids.customerA, () => count("select count(*) as n from purchases where business_id = $1", [ids.businessB]))).toBe(0);
    expect(await asUser(ids.customerA, () => count("select count(*) as n from business_customers"))).toBe(1);
  });

  test("staff read their business, not the other tenant", async () => {
    expect(await asUser(ids.staffA, () => count("select count(*) as n from ledger where business_id = $1", [ids.businessA]))).toBe(1);
    expect(await asUser(ids.staffA, () => count("select count(*) as n from ledger where business_id = $1", [ids.businessB]))).toBe(0);
    expect(await asUser(ids.staffA, () => count("select count(*) as n from purchases where business_id = $1", [ids.businessB]))).toBe(0);
  });

  test("an owner can read the other tenant's public row but no money rows", async () => {
    expect(await asUser(ids.ownerB, () => count("select count(*) as n from businesses where id = $1", [ids.businessA]))).toBe(1);
    expect(await asUser(ids.ownerB, () => count("select count(*) as n from ledger where business_id = $1", [ids.businessA]))).toBe(0);
    expect(await asUser(ids.ownerB, () => count("select count(*) as n from redemptions where business_id = $1", [ids.businessA]))).toBe(0);
  });

  test("an admin reads every tenant", async () => {
    expect(await asUser(ids.admin, () => count("select count(*) as n from ledger"))).toBe(2);
    expect(await asUser(ids.admin, () => count("select count(*) as n from purchases"))).toBe(2);
    expect(await asUser(ids.admin, () => count("select count(*) as n from audit_log"))).toBe(1);
    expect(await asUser(ids.admin, () => count("select count(*) as n from users"))).toBe(6);
  });

  test("money-bearing tables reject browser writes", async () => {
    // Inserts violate the missing WITH CHECK clause and raise.
    await expect(
      asUser(ids.customerA, (q) =>
        q("insert into ledger (business_id, customer_id, delta, kind) values ($1,$2,999,'adjust')", [ids.businessA, ids.customerA]),
      ),
    ).rejects.toThrow(/row-level security|permission denied/i);
    await expect(
      asUser(ids.customerA, (q) =>
        q(
          "insert into purchases (business_id, customer_id, staff_id, amount_paise, points_awarded, idempotency_key) values ($1,$2,$2,1000,10,'rls-hack')",
          [ids.businessA, ids.customerA],
        ),
      ),
    ).rejects.toThrow(/row-level security|permission denied/i);

    // Updates and deletes either raise (no grant) or match no row; both leave the ledger intact.
    const updated = await asUser(ids.customerA, (q) =>
      q("update ledger set delta = 999 where customer_id = $1", [ids.customerA]),
    ).catch(() => ({ rowCount: 0 }));
    expect(updated.rowCount).toBe(0);
    const deleted = await asUser(ids.customerA, (q) =>
      q("delete from ledger where customer_id = $1", [ids.customerA]),
    ).catch(() => ({ rowCount: 0 }));
    expect(deleted.rowCount).toBe(0);

    const balance = Number((await client.query("select coalesce(sum(delta),0) as n from ledger where customer_id = $1", [ids.customerA])).rows[0].n);
    expect(balance).toBe(100);
  });

  test("a user cannot edit another user's profile or promote themselves", async () => {
    const other = await asUser(ids.customerA, (q) => q("update users set name = 'hacked' where id = $1", [ids.customerB]));
    expect(other.rowCount).toBe(0);
    expect((await client.query("select name from users where id = $1", [ids.customerB])).rows[0].name).toBe("Customer B");

    // The column grant, not the row policy, is what stops privilege escalation.
    await expect(
      asUser(ids.customerA, (q) => q("update users set role = 'admin' where id = $1", [ids.customerA])),
    ).rejects.toThrow(/permission denied/i);
    expect((await client.query("select role from users where id = $1", [ids.customerA])).rows[0].role).toBe("customer");

    const own = await asUser(ids.customerA, (q) => q("update users set name = 'Customer A2' where id = $1", [ids.customerA]));
    expect(own.rowCount).toBe(1);
  });

  test("sessions and audit log are server-only", async () => {
    expect(await asUser(ids.customerA, () => count("select count(*) as n from sessions"))).toBe(0);
    expect(await asUser(ids.customerA, () => count("select count(*) as n from audit_log"))).toBe(0);
  });

  test("joining is allowed only for yourself on an active business", async () => {
    await expect(
      asUser(ids.customerB, (q) => q("insert into business_customers (business_id, user_id) values ($1,$2)", [ids.businessA, ids.customerB])),
    ).resolves.toBeDefined();
    await expect(
      asUser(ids.customerB, (q) => q("insert into business_customers (business_id, user_id) values ($1,$2)", [ids.businessA, ids.customerA])),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      asUser(ids.customerB, (q) => q("insert into business_customers (business_id, user_id) values ($1,$2)", [ids.suspended, ids.customerB])),
    ).rejects.toThrow(/row-level security/i);
  });

  test("a new business can be claimed by exactly one owner", async () => {
    const businessId = await asUser(ids.customerB, async (q) => {
      const claim = (id: number) =>
        q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: String(id) })]);
      const created = await q("insert into businesses (name, slug, category) values ('RLS New','rls-new','Cafe') returning id");
      const id = Number(created.rows[0].id);
      await expect(
        q("insert into business_members (user_id, business_id, role) values ($1,$2,'owner')", [ids.customerB, id]),
      ).resolves.toBeDefined();
      // A different user cannot claim it: the bootstrap policy needs an unowned business.
      await claim(ids.customerA);
      await expect(
        q("insert into business_members (user_id, business_id, role) values ($1,$2,'owner')", [ids.customerA, id]),
      ).rejects.toThrow(/row-level security/i);
      return id;
    });
    expect(businessId).toBeGreaterThan(0);
  });

  test("staff cannot manage the team, owners can", async () => {
    await expect(
      asUser(ids.staffA, (q) => q("insert into business_members (user_id, business_id, role) values ($1,$2,'staff')", [ids.customerA, ids.businessA])),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      asUser(ids.ownerA, (q) => q("insert into business_members (user_id, business_id, role) values ($1,$2,'staff')", [ids.customerB, ids.businessA])),
    ).resolves.toBeDefined();
  });
});
