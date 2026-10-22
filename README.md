# Repeato

Multi-tenant loyalty and retention software for cafés and restaurants. A customer scans a
business's QR code, joins once, and earns points when staff record a verified purchase. Points
buy rewards; each reward becomes a one-time voucher that staff redeem at the counter.

The product rule that shapes everything: **a QR scan never awards points.** Scanning only
identifies the business. Points are written by the server, in a transaction, from a staff-recorded
sale. Nothing about a balance is ever accepted from a browser.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.4 (App Router, Turbopack), React 19, TypeScript strict |
| Styling | Tailwind CSS 4 with a small token layer in `app/globals.css`; Lucide icons |
| Data (this build) | SQLite via `better-sqlite3` (WAL, foreign keys, schema in `lib/schema.ts`) |
| Data (production target) | Supabase / Postgres with RLS — `supabase/migrations/` |
| Server logic | Server Components + Server Actions; all mutations in `lib/services.ts` |
| Tests | Vitest (domain + services), Playwright (browser flows) |
| Charts | Recharts (`components/trend-chart.tsx`) |

## Quick start

```bash
npm install
npm run seed     # creates data/repeato.db with demo businesses and prints credentials
npm run dev      # http://localhost:3000
```

`npm run seed` refuses to run twice: it prints `Database already has users - seed skipped.`
Delete `data/` to start over.

### Demo accounts

All demo users share the password from `DEMO_PASSWORD`, default `Repeato!2026`.

| Role | Email | Notes |
| --- | --- | --- |
| Platform admin | `admin@repeato.local` | password is random, printed once by the seed |
| Business owner | `priya@bluebird.test` | Bluebird Coffee, Bengaluru |
| Business staff | `arun@bluebird.test` | staff at Bluebird Coffee |
| Business owner | `daniel@urbanbrew.test` | Urban Brew Cafe, Mumbai |
| Customers | `asha@example.test`, `ravi@example.test`, `meera@example.test` | members of both businesses, with purchase history |

Demo join links: `/join/bluebird-coffee`, `/join/urban-brew-cafe`.

Seeded data is demo data: purchases are backdated and a `platform.seeded` row is written to the
audit log. No metric, testimonial or customer count on the marketing site is presented as real
traction.

## What actually works

- **Join by QR.** `/join/<slug>` is the QR target. Joining is idempotent — a second scan reports
  "already a member" and does not duplicate the signup bonus.
- **Staff-verified purchases.** `recordPurchase` requires a member of that business, an integer
  amount, an idempotency key, and writes the purchase + ledger row in one immediate transaction.
  A replayed submission returns the original purchase instead of paying twice.
- **Points math in one place.** `lib/points.ts` — per-business rate, minimum bill, per-transaction
  cap, and per-product overrides that are excluded from the spend formula so nothing counts twice.
- **Reversals, not deletions.** Reversing a sale writes a compensating ledger entry and marks the
  purchase `reversed`; the history stays intact.
- **Redemption tokens.** 8 characters, generated server-side, unique, expiring after 14 days, and
  single-use via a guarded status transition. Redeeming twice fails on the second attempt.
- **Ledger-only balances.** `SUM(ledger.delta)` is the balance everywhere. There is no mutable
  `points` column to drift.
- **Tenant isolation.** Every business-owned row carries `business_id`; the service layer checks
  membership on each call, and `/api/qr/<slug>` returns 401/403 instead of leaking another
  business's QR image.
- **Four roles.** `admin`, `owner`, `staff`, `customer`, enforced in `lib/auth.ts` and re-checked
  server-side in every action.
- **Customer app** with bottom navigation: home, businesses, wallet, rewards, history,
  notifications, profile.
- **Business console** with 12 sections: dashboard, transactions, customers, customer detail,
  loyalty rules, menu & categories, rewards, redemptions, QR code, analytics, team, settings.
- **Admin console**: businesses (approve/suspend), users, audit log, platform overview.

## Routes

```
/                      marketing: /features /how-it-works /for-businesses /pricing
                       /about /contact /privacy /terms /login /signup /onboarding
/join/<slug>           QR landing + join
/app                   customer: /app/businesses /app/wallet /app/rewards /app/vouchers
                       /app/activity /app/notifications /app/profile
/biz                   business: /biz/transactions /biz/customers /biz/customers/<id>
                       /biz/loyalty /biz/menu /biz/rewards /biz/redemptions /biz/qr
                       /biz/analytics /biz/team /biz/settings
/admin                 admin: /admin/businesses /admin/users /admin/audit
/api/qr/<slug>         PNG QR (tenant-private)
```

## Scripts

```bash
npm run dev        # dev server on :3000
npm run build      # production build
npm start          # serve the build
npm test           # Vitest: points, services
npx playwright test# browser flows (starts its own dev server)
npm run typecheck  # tsc --noEmit
npm run seed       # demo data
```

## Environment

Copy `.env.example` to `.env.local`. The app itself reads only `DATABASE_PATH` (default
`./data/repeato.db`); the seed also reads `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and
`DEMO_PASSWORD`. The commented Supabase keys are for the Postgres adapter described in
`docs/DEPLOYMENT.md` — this build does not require them.

## Data layer, stated plainly

This repository runs on SQLite because no Supabase project could be provisioned in the build
environment (no access token, no Docker for a local stack). The domain logic, transactions,
tenancy checks and tests are real and are the same logic the Postgres deployment would run.
`supabase/migrations/0001_init.sql` and `0002_rls.sql` are the production schema and policies;
they are not exercised by the running app. Details and the exact gap are in
`docs/KNOWN_LIMITATIONS.md`.

## Docs

- `docs/PRODUCT_REQUIREMENTS.md` — what was asked, what was built, what was deliberately skipped
- `docs/ARCHITECTURE.md` — request paths, module boundaries, key flows
- `docs/DATABASE_SCHEMA.md` — tables, relations, invariants
- `docs/SECURITY.md` — threat model, controls, RLS, known gaps
- `docs/FIGMA_DESIGN.md` — design tokens, screens, and why no Figma file exists
- `docs/TESTING.md` — how to run everything, and the real results
- `docs/DEPLOYMENT.md` — Vercel + Supabase path, step by step
- `docs/KNOWN_LIMITATIONS.md` — everything that is missing or fake-adjacent, listed honestly
