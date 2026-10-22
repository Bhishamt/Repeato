# Database schema

Two artefacts describe the same model:

- `lib/schema.ts` — SQLite DDL the running app applies on boot (idempotent `CREATE … IF NOT EXISTS`).
- `supabase/migrations/0001_init.sql` — Postgres/Supabase equivalent, plus `0002_rls.sql` for
  policies. Same columns, `uuid` primary keys, `timestamptz` timestamps.

## Conventions

- Money is `INTEGER` **paise** (₹1 = 100). No decimals, no floats.
- Points are `INTEGER`, whole units only.
- A balance is never stored. It is `SUM(ledger.delta)` for `(business_id, customer_id)`.
- Every business-owned table carries `business_id` and every console query filters on it.
- Timestamps are `TEXT` in SQLite (`datetime('now')`) and `timestamptz` in Postgres.

## Tables

### Identity

| `users` | |
| --- | --- |
| `id` | PK |
| `email` | unique, case-insensitive in SQLite |
| `name`, `phone` | profile |
| `password_hash` | `scrypt` — `s1$<salt>$<hash>`; null for users created by an external IdP |
| `role` | `owner` \| `staff` \| `customer` \| `admin` |
| `status` | `active` \| `suspended` |
| `created_at` | |

`role` describes the account's primary surface. A person can be "owner" and still be a customer of
another business — that relationship lives in `business_customers`, not in `role`.

| `sessions` | |
| --- | --- |
| `token_hash` | PK — SHA-256 of the cookie value; the raw token only exists in the browser |
| `user_id` | FK users |
| `expires_at` | 30 days, sliding on use |
| `created_at` | |

### Tenancy and catalogue

| `businesses` | |
| --- | --- |
| `id`, `name`, `slug` (unique), `category`, `description` | |
| `brand_color`, `address`, `city`, `phone` | presentation |
| `status` | `pending` \| `active` \| `suspended` |
| `points_per_100`, `min_purchase_paise`, `signup_bonus`, `min_redeem_points`, `max_points_per_txn` | loyalty rules, per business |
| `created_at` | |

| `business_members` | `business_customers` |
| --- | --- |
| `(user_id, business_id)` PK | `(business_id, user_id)` PK |
| `role`: `owner` \| `staff` | `joined_at` |
| `created_at` | |

| `categories` | `products` |
| --- | --- |
| `id`, `business_id`, `name`, `sort_order` | `id`, `business_id`, `category_id` |
| unique `(business_id, name)` | `name`, `description`, `price_paise` |
| | `points_override` (nullable — blank means "use the spend rule") |
| | `available`, `archived` |

| `rewards` | |
| --- | --- |
| `id`, `business_id`, `name`, `description` | |
| `points_cost` | integer |
| `active` | |
| `stock` | nullable; null means unlimited |
| `per_customer_limit` | nullable |
| `valid_until` | nullable |

### Money and points

| `purchases` | |
| --- | --- |
| `id`, `business_id`, `customer_id`, `staff_id` | who bought, who recorded |
| `amount_paise` | integer minor units |
| `points_awarded` | integer, copied from the calculation for auditability |
| `status` | `verified` \| `reversed` |
| `reference`, `note` | receipt number, free text |
| `idempotency_key` | **unique** — a replayed submit returns the original row |
| `created_at`, `reversed_at` | |

| `purchase_items` | |
| --- | --- |
| `id`, `purchase_id`, `product_id`, `name` | name is copied so history survives product edits |
| `unit_price_paise`, `quantity`, `points` | per-line snapshot |

| `ledger` | |
| --- | --- |
| `id`, `business_id`, `customer_id` | |
| `purchase_id`, `redemption_id` | nullable references to the cause |
| `delta` | non-zero integer, may be negative |
| `kind` | `earn` \| `redeem` \| `reverse` \| `adjust` \| `bonus` |
| `note`, `created_at` | |

Append-only. There is no update or delete path in the application; corrections are new rows. The
only exception is a developer running SQL by hand, which no code path does.

| `redemptions` | |
| --- | --- |
| `id`, `business_id`, `customer_id`, `reward_id` | |
| `points_spent` | integer |
| `token` | **unique**, 8 chars, A–Z/0–9, generated server-side |
| `status` | `issued` \| `redeemed` \| `cancelled` |
| `issued_at`, `expires_at` (+14 days), `redeemed_at`, `redeemed_by` | |

### Platform

| `notifications` | |
| --- | --- |
| `id`, `user_id`, `business_id` (nullable), `title`, `body` | |
| `read_at`, `created_at` | in-app inbox only |

| `audit_log` | |
| --- | --- |
| `id`, `actor_id` (nullable), `action`, `entity`, `entity_id`, `meta` (JSON), `created_at` | |

Actions recorded include `business.created`, `customer.joined`, `purchase.recorded`,
`purchase.reversed`, `reward.redeemed`, `reward.verified`, `points.adjusted`, `staff.invited`,
`business.status`, `platform.seeded`.

## Invariants

1. `ledger.delta <> 0` (CHECK constraint).
2. `purchases.idempotency_key` is unique; the service returns the existing purchase rather than
   inserting a second one.
3. A redemption's `status` transition is guarded (`UPDATE … WHERE status = 'issued'`), so two staff
   can race and exactly one wins.
4. Stock decrement is guarded (`WHERE stock > 0`), so overselling is impossible.
5. `purchase_items` totals must equal `purchases.amount_paise` when line items are supplied.
6. `SUM(ledger.delta)` is the only definition of a balance.

## Derived queries

```sql
-- balance
SELECT COALESCE(SUM(delta), 0) FROM ledger WHERE business_id = ? AND customer_id = ?;

-- 30-day revenue
SELECT date(created_at) AS day, COUNT(*) AS visits, SUM(amount_paise) AS revenue
FROM purchases
WHERE business_id = ? AND status = 'verified' AND created_at >= datetime('now', '-29 days')
GROUP BY day ORDER BY day;

-- repeat rate
SELECT COUNT(*) FROM (
  SELECT customer_id FROM purchases
  WHERE business_id = ? AND status = 'verified'
  GROUP BY customer_id HAVING COUNT(*) > 1
);
```

## Why no `qr_codes` or `visits` table

The QR payload is `${APP_URL}/join/<slug>`; the slug already identifies the business, so a QR table
would duplicate it. Scans are not recorded: a scan has no business meaning in this product, and
logging it would imply attribution the app cannot prove. `business_customers.joined_at` is the only
real "arrival" timestamp.

## Migration notes (SQLite → Postgres)

- Integer PKs become `uuid` (`gen_random_uuid()`); foreign keys map accordingly.
- `datetime('now')` becomes `now()`; text timestamps become `timestamptz`.
- SQLite's `INSERT OR IGNORE` becomes `INSERT … ON CONFLICT DO NOTHING`.
- `BEGIN IMMEDIATE` transactions become ordinary transactions with the same statements; use
  `SELECT … FOR UPDATE` on the reward row if you want the stock check serialised explicitly.
- The partial index and CHECK constraints carry over unchanged.
