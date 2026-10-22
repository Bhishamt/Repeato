# Deployment

Repeato runs on two database engines behind one interface (`lib/db.ts`):

| Engine | Driver | Use |
| --- | --- | --- |
| SQLite (`DATABASE_PATH`) | `better-sqlite3` | local development, tests, single-node hosting |
| PostgreSQL (`DATABASE_URL`) | `pg` pool | Supabase, Neon, RDS, any managed Postgres |

Pick one with environment variables — nothing else in the code changes. Money is stored as integer
paise and points as integers on both engines.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | production | `postgres://...` — takes priority over `DATABASE_PATH` |
| `DATABASE_PATH` | local | defaults to `./data/repeato.db`; `:memory:` for throwaway runs |
| `APP_URL` | production | canonical origin used in QR codes, no trailing slash |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | seed only | blank password prints a random one once |
| `DEMO_PASSWORD` | seed only | password for the demo accounts |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | production | shared rate-limit store; without them limits are per-process |
| `PG_TEST_URL` | CI | database used by the RLS suite |

Never commit real values. `.env` is gitignored; `.env.example` documents the shape.

## Option A — single Node host (SQLite, works today)

```bash
npm ci
npm run build
npm start          # :3000
```

Needs a persistent disk (Fly volume, VPS, container with a volume). Not suitable for Vercel
Functions, which have an ephemeral filesystem and no single-writer guarantee.

## Option B — managed PostgreSQL (Supabase, recommended for production)

1. Create a Supabase project and copy the connection string. Use the **pooled** connection string
   (port `6543`, `?pgbouncer=true`) for the app and the direct one (port `5432`) for migrations.
2. Apply the schema and the RLS policies in order:

   ```bash
   DATABASE_URL="postgres://...:5432/postgres" node scripts/migrate.mjs
   ```

   `scripts/migrate.mjs` applies every file in `supabase/migrations/` in filename order and records
   them in `schema_migrations`, so re-running it is safe.
3. Create the platform admin (seed skips demo data when `NODE_ENV=production`):

   ```bash
   NODE_ENV=production DATABASE_URL="postgres://...:6543/postgres" ADMIN_EMAIL=you@example.com npm run seed
   ```

4. Deploy the app with `DATABASE_URL` set, plus `APP_URL` and the Upstash pair.
5. Run the smoke tests in `## Post-deploy smoke test`.

### About RLS on Supabase

`supabase/migrations/0002_rls.sql` enables row-level security on every table and defines policies
that read the caller from `request.jwt.claims`. That is what the Supabase PostgREST layer uses.

**The Next.js app connects as the database owner, so RLS does not apply to it.** Its isolation comes
from `lib/services.ts`, which scopes every query by `business_id` and re-checks membership with
`requireMember` before each write. RLS is the second line of defence for any future client that talks
to Supabase directly (PostgREST, a mobile app, an edge function). Keep both: the RLS suite in
`test/pg-rls.test.ts` proves the policies, and the service layer proves the app.

If you later expose Supabase directly to browsers, create a separate `authenticated` role login
instead of connecting as the owner, or the policies will never run.

## Migrations

`supabase/migrations/` is the single source of truth for the Postgres schema:

- `0001_init.sql` — tables, constraints, indexes. Boolean-ish columns (`products.available`,
  `products.archived`, `rewards.active`) are `integer` with a `check (col in (0, 1))` so the same SQL
  runs on SQLite and Postgres.
- `0002_rls.sql` — helper functions (`is_admin`, `is_member`, `owns`, `is_customer`,
  `business_is_active`, `has_no_members`) and the policies.

To change the schema: add `0003_*.sql`, run `node scripts/migrate.mjs`, then mirror the change in
`lib/schema.ts` (the SQLite bootstrap) so local development stays in step. The test suite runs
against both engines, so a missed mirror shows up immediately.

## Backups and recovery

- Supabase: enable Point-in-Time Recovery on the paid tier; otherwise take a nightly `pg_dump` and
  store it off-platform. Test a restore before launch — an untested backup is a guess.
- The ledger is append-only by design (`ledger` rows are never updated or deleted; corrections are
  new rows with `kind = 'adjust'` or `'reverse'`). A restored dump therefore reproduces balances
  exactly: `balance = SUM(delta)`.
- `purchases.idempotency_key` is unique, so a replayed import cannot double-award points.

## Post-deploy smoke test

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$APP_URL/"            # 200
curl -sS -o /dev/null -w '%{http_code}\n' "$APP_URL/biz"         # 307 -> /login
curl -sS -o /dev/null -w '%{http_code}\n' "$APP_URL/join/<slug>" # 200
```

Then, in a browser: join a business through `/join/<slug>`, record a sale in `/biz/transactions`,
redeem a reward, verify the voucher once in `/biz/redemptions`, and confirm the second attempt is
rejected. That is the whole money path.

## Production checklist

- [ ] `DATABASE_URL` points at pooled Postgres; migrations applied
- [ ] `APP_URL` is the real HTTPS origin (QR codes embed it)
- [ ] Upstash credentials set, so rate limits are shared across instances
- [ ] `NODE_ENV=production` (enables `Secure` cookies and HSTS)
- [ ] Admin account created and the demo seed skipped
- [ ] Nightly backup scheduled and one restore rehearsed
- [ ] Uptime check on `/` and on one authenticated route
- [ ] Email provider connected before promising password reset (not implemented yet)

## What is not automated

There is no CI pipeline in this repository and no deploy has been executed — no hosting or Supabase
credentials were available. `npm run typecheck`, `npm test`, `npx playwright test` and `npm run build`
are the gates to wire into CI in that order.
