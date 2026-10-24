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
| Data | SQLite (`better-sqlite3`) or PostgreSQL (`pg`) behind one interface in `lib/db.ts` |
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
- **Loyalty tiers & progression.** `lib/points.ts` provides multi-tier tracking (`Bronze`, `Silver`, `Gold`, `Platinum`), perk calculations (discounts and point multipliers), upgrade progress math, promo bonus boosts, and points expiration monitoring with 30-day early warnings.
- **Secure CSV exports & reporting.** `lib/csv.ts` provides RFC 4180 compliant CSV formatting with spreadsheet formula injection mitigation (CWE-1236) for transactions and customers.
- **Domain validation & formatting.** `lib/validate.ts` and `lib/format.ts` standardize input boundaries (slugs, vouchers, currencies, percentages, filenames) and localized date/currency/phone presentation.


## Loyalty Tiers & Progression

Repeato supports tiered loyalty mechanics with automated progression tracking:

| Tier | Qualifying Threshold | Member Perks & Benefits |
| :--- | :--- | :--- |
| **Bronze** | Baseline (0 - 199 pts / < ₹2,000 spend) | Standard 1 pt per ₹100 spend |
| **Silver** | 200 pts or ₹2,000 lifetime spend | 5% bill discount + 10% points accelerator |
| **Gold** | 500 pts or ₹5,000 lifetime spend | 10% bill discount + 25% points accelerator |
| **Platinum** | 1,000 pts or ₹10,000 lifetime spend | 15% bill discount + 50% points accelerator + priority service |

Key helper utilities exported in [`lib/points.ts`](file:///d:/project/Repeato/lib/points.ts):
- `calculateCustomerTier(points, spendPaise)`: Computes active member tier.
- `getTierPerks(tier)`: Returns discount percentage and points accelerator rate.
- `calculateTierUpgradeRequirements(points, spendPaise)`: Computes remaining points, spend needed, and completion percentage to achieve the next tier.
- `calculatePromotionalBonus(basePoints, multiplier, flatBonus)`: Calculates bonus points for double-points events and special campaigns.
- `calculatePointsExpiration(lastActivity, retentionDays)`: Calculates expiry timelines and triggers 30-day proactive warning thresholds.

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
npm test           # Vitest: points, services, RLS (RLS needs PG_TEST_URL)
npx playwright test# browser flows (starts its own dev server)
npm run typecheck  # tsc --noEmit
npm run seed       # demo data
node scripts/pg.mjs start     # local PostgreSQL 18.4 on :55432
node scripts/migrate.mjs      # apply supabase/migrations/*.sql
```

## Environment

Copy `.env.example` to `.env.local`. The app picks its engine from the environment:
`DATABASE_URL` (Postgres) wins, otherwise `DATABASE_PATH` (SQLite, default `./data/repeato.db`). The
seed also reads `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `DEMO_PASSWORD`; the RLS suite reads
`PG_TEST_URL`; `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` switch rate limiting to a shared
store.

## Data layer, stated plainly

One interface (`lib/db.ts`) with two drivers: `better-sqlite3` for local development and a `pg` pool
for PostgreSQL. Both are real and both are exercised — `npx playwright test` passes 4/4 with the app
running on SQLite and 4/4 with `DATABASE_URL` pointing at PostgreSQL 18.4, and the RLS policies are
verified against that same server by `test/pg-rls.test.ts` (11 tests). What was **not** possible this
session is a run against a hosted Supabase project: no access token and no Docker were available, so
the migration has been proven on a real PostgreSQL server but not on Supabase itself. `docs/DEPLOYMENT.md`
has the exact steps, and `docs/KNOWN_LIMITATIONS.md` lists the rest.

## Docs

- `docs/PRODUCT_REQUIREMENTS.md` — what was asked, what was built, what was deliberately skipped
- `docs/ARCHITECTURE.md` — request paths, module boundaries, key flows
- `docs/DATABASE_SCHEMA.md` — tables, relations, invariants
- `docs/SECURITY.md` — threat model, controls, RLS, known gaps
- `docs/FIGMA_DESIGN.md` — design tokens, screens, and why no Figma file exists
- `docs/TESTING.md` — how to run everything, and the real results
- `docs/DEPLOYMENT.md` — Vercel + Supabase path, step by step
- `docs/KNOWN_LIMITATIONS.md` — everything that is missing or fake-adjacent, listed honestly
