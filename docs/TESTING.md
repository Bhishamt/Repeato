# Testing

## Commands

| Command | What it proves |
| --- | --- |
| `npm run typecheck` | TypeScript strict, no emit |
| `npm test` | unit + service integration (+ RLS when `PG_TEST_URL` is set) |
| `npx playwright test` | four end-to-end journeys in a real browser |
| `npm run build` | production build succeeds |

## Current results (last full run)

```
npm run typecheck     exit 0, no output
npm test              3 files, 37 tests passed  (~0.6s)
npx playwright test   4 passed                  (~13s)
npm run build         succeeded, every app route dynamic
```

The Playwright suite was run twice: once with the app on SQLite, once with
`DATABASE_URL=postgres://postgres@127.0.0.1:55432/repeato_demo` — 4/4 both times.

## What the suites cover

`test/points.test.ts` (9) — earning rules: points per 100 major units, minimum purchase, per-transaction
cap, product-level point overrides excluded from the spend formula, zero and nonsense input, ledger
summation.

`test/services.test.ts` (17) — the domain rules that protect money:
- a purchase below the business minimum awards nothing;
- the same idempotency key submitted concurrently produces one purchase and one ledger row;
- reversing a purchase removes the points it awarded and cannot run twice;
- redemption respects the business minimum, the reward cost, stock and per-customer limits;
- **three concurrent redemption attempts against a balance that funds one produce exactly one voucher**;
- a voucher verifies once; four concurrent verifications yield one success;
- cross-tenant reads and writes are rejected;
- an admin adjustment cannot push a balance below zero.

`test/pg-rls.test.ts` (11) — the Postgres policies, executed against a real PostgreSQL server.
Each test assumes a user identity the way Supabase does
(`set_config('request.jwt.claims', '{"sub":"7"}', true)` + `set role authenticated`) and then tries to
read or write another tenant's data:
- an owner sees only their own business; staff see only the business they belong to;
- a customer cannot read another customer's ledger or purchases;
- the platform admin can read everything;
- cross-tenant inserts and updates are refused by the database itself;
- a new business can be claimed by exactly one owner;
- team management is owner-only.

## Running the RLS suite locally

No Docker or Supabase account is required — `embedded-postgres` provides real PostgreSQL binaries.

```bash
node scripts/pg.mjs start                       # PostgreSQL 18.4 on 127.0.0.1:55432
node scripts/pg.mjs reset                       # drops and recreates repeato_test
PG_TEST_URL=postgres://postgres@127.0.0.1:55432/repeato_test npm test
node scripts/pg.mjs stop
```

To exercise the whole application on Postgres rather than just the policies:

```bash
node scripts/pg.mjs start
DATABASE_URL=postgres://postgres@127.0.0.1:55432/repeato_demo node scripts/migrate.mjs
DATABASE_URL=postgres://postgres@127.0.0.1:55432/repeato_demo npm run seed
DATABASE_URL=postgres://postgres@127.0.0.1:55432/repeato_demo npm run dev
npx playwright test
```

## End-to-end journeys (`e2e/smoke.spec.ts`)

1. every marketing route renders;
2. `/biz`, `/admin`, `/app` redirect signed-out visitors to `/login`;
3. QR join → signup → staff-recorded sale → points → reward redemption → voucher shown → staff
   verification → **second verification rejected**;
4. a business never sees another tenant's data (menu items and QR downloads are scoped).

`playwright.config.ts` starts `npm run dev` itself and reuses a running server, so it works against
whichever engine `DATABASE_URL` selects.

## Not covered yet

- Component-level tests (React Testing Library is not installed).
- Email delivery, password reset and verification flows — no provider is configured.
- Load and soak testing; the concurrency assertions are correctness checks, not benchmarks.
- Mobile layout is checked by hand at 390px, not asserted in CI.
