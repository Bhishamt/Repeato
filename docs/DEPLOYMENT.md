# Deployment

Repeato runs on two database engines behind one interface (`lib/db.ts`):

| Engine | Driver | Use |
| --- | --- | --- |
| SQLite (`DATABASE_PATH`) | `better-sqlite3` (lazy-loaded) | local development, tests, single-node hosting |
| PostgreSQL (`DATABASE_URL`) | `pg` pool | Supabase, Neon, RDS, any managed Postgres |

Pick one with environment variables — nothing else in the code changes. Money is stored as integer
paise and points as integers on both engines.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | production | `postgres://repeato_app:...@...:6543/postgres?sslmode=require` |
| `DATABASE_PATH` | local | defaults to `./data/repeato.db`; `:memory:` for throwaway runs |
| `APP_URL` | production | canonical origin used in QR codes, emails, no trailing slash |
| `RESEND_API_KEY` | production | Resend API key for verification & password reset emails |
| `MAIL_FROM` | production | Sender address (e.g. `Repeato <no-reply@yourdomain.com>`) |
| `UPSTASH_REDIS_REST_URL` | production | Upstash Redis REST URL for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | production | Upstash Redis REST bearer token |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | seed only | Initial platform admin credentials |
| `PG_POOL_MAX` | optional | Max database connections per instance (default: 10, set to 2 for serverless) |
| `PG_SSL` | optional | SSL mode: `require`, `no-verify`, or `disable` |
| `ADMIN_DATABASE_URL` | setup only | Direct postgres connection (port 5432) for migrations and role provisioning |

Never commit real values. `.env` is gitignored; `.env.example` documents the shape.

## Option A — single Node host (SQLite, container with volume)

```bash
npm ci
npm run build
npm start          # :3000
```

Needs a persistent disk (Fly volume, VPS, container with persistent volume). Not suitable for Vercel
Functions, which have an ephemeral filesystem and no single-writer guarantee.

## Option B — managed PostgreSQL (Supabase / Vercel)

### 1. Provision a Dedicated Supabase Project
1. In the Supabase Dashboard, create a dedicated project for Repeato.
2. Under **Project Settings > Database**, note:
   - Direct connection string (`db.<ref>.supabase.co:5432/postgres`)
   - Transaction pooler string (`<pooler-host>:6543/postgres?pgbouncer=true`)

### 2. Apply Migrations (as Database Admin)
Connect directly as `postgres` on port 5432 to execute DDL and role creation:

```bash
DATABASE_URL="postgres://postgres:<admin_password>@db.<ref>.supabase.co:5432/postgres" node scripts/migrate.mjs
```

`scripts/migrate.mjs` applies every migration in order:
- `0001_init.sql` — Tables, foreign keys, check constraints, indexes, views.
- `0002_rls.sql` — RLS policies and JWT helper functions for public/authenticated roles.
- `0003_app_role.sql` — Creates least-privilege `repeato_app` role without DDL or delete privileges on financial tables.
- `0004_email_tokens.sql` — Single-use verification and password reset tokens table.

### 3. Set Application Role Password
Set a secure generated password for the `repeato_app` role:

```sql
ALTER ROLE repeato_app PASSWORD '<generate_strong_password>';
```

Verify that the role cannot alter the schema or delete audit/ledger records:

```bash
ADMIN_DATABASE_URL="postgres://postgres:<admin_password>@db.<ref>.supabase.co:5432/postgres" \
APP_DB_USER="repeato_app" \
APP_DB_PASSWORD="<generate_strong_password>" \
node scripts/verify-db-role.mjs
```

### 4. Seed Platform Admin
```bash
NODE_ENV=production \
DATABASE_URL="postgres://repeato_app:<password>@<pooler-host>:6543/postgres?sslmode=require" \
ADMIN_EMAIL=admin@yourdomain.com \
npm run seed
```

### 5. Configure Hosting (e.g. Vercel)
Set the environment variables in your hosting dashboard:
- `DATABASE_URL`: `postgres://repeato_app:<password>@<pooler-host>:6543/postgres?sslmode=require`
- `APP_URL`: `https://yourdomain.com`
- `RESEND_API_KEY`: `re_...`
- `MAIL_FROM`: `Repeato <no-reply@yourdomain.com>`
- `UPSTASH_REDIS_REST_URL`: `https://...upstash.io`
- `UPSTASH_REDIS_REST_TOKEN`: `...`
- `NODE_ENV`: `production`

> [!NOTE]
> Serverless platforms like Vercel re-instantiate containers on demand. The database adapter uses `pg` with pool limits and lazy loads `better-sqlite3` only in SQLite mode, ensuring full compatibility with serverless Linux runtimes.

## Automated CI Pipeline

Both local and remote CI pipelines are available:
- **Remote CI (GitHub Actions)**: `.github/workflows/ci.yml` runs clean `npm ci`, typecheck, Postgres migrations against a Docker service container, DB role checks, Vitest tests, Next.js production build, and Playwright e2e tests.
- **Local CI runner**: Run `npm run ci` locally anytime to execute all checks in sequence with detailed timings and verification.

## Backups and Recovery

- **Supabase PITR**: Enable Point-in-Time Recovery on the project.
- **Append-Only Ledger**: Balances are calculated as `SUM(ledger.delta)`. The ledger is append-only, and corrections are made via `adjust` or `reverse` transactions. Replay and restore reproduce points balances exactly.
- **Idempotency**: All purchases carry an `idempotency_key` unique constraint, preventing double-credits on retry or network hiccups.

## Post-Deploy Smoke Test

Run the following checks against your live production domain:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$APP_URL/"            # 200
curl -sS -o /dev/null -w '%{http_code}\n' "$APP_URL/biz"         # 307 -> /login
curl -sS -o /dev/null -w '%{http_code}\n' "$APP_URL/join/<slug>" # 200
```

Browser verification steps:
1. Scan QR code / visit `/join/<slug>` and join.
2. Verify signup bonus appears in customer wallet.
3. Sign in as business staff/owner in `/biz/transactions` and record a sale.
4. Confirm points awarded correctly to customer wallet.
5. In `/app/rewards`, redeem a reward to generate an 8-character voucher code.
6. In `/biz/redemptions`, enter voucher code and verify. Confirm status changes to redeemed.
7. Attempt verifying the same voucher a second time; confirm it is immediately rejected as already redeemed.
