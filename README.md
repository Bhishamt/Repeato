# Repeato

Modern loyalty software for cafés and restaurants.

Repeato lets customers join from a QR code, earn points from staff-recorded purchases, and redeem one-time rewards at the counter.

The core rule is simple: a QR scan never awards points. Points are written only by the server, in a transaction, after a verified sale.

## Why it exists

- Multi-tenant by design
- Customer join flows via QR
- Staff-verified purchases only
- Points tracked via ledger, not mutable balance fields
- Rewards and vouchers redeemable once
- Role-based access for admin, owner, staff, and customer

## Product flow

1. A customer scans a business QR code.
2. They join once and become a member for that business.
3. Staff record a purchase and the server writes points.
4. Points convert into rewards and redeemable vouchers.
5. All balances are derived from ledger entries, keeping the system auditable and consistent.

## Features

- QR membership and tenant isolation
- Staff-verified purchases with idempotency protection
- Reward and voucher lifecycle management
- Ledger-based points and balance calculation
- Loyalty tiers and progression logic
- Business, customer, and admin console views
- Audit-friendly transaction and reversal history
- CSV exports and security-minded validation

## Stack

- Next.js 16 + App Router
- React 19 + TypeScript
- Tailwind CSS
- SQLite for local dev, PostgreSQL for production-like environments
- Vitest for unit and service tests
- Playwright for browser flows

## Quick start

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:3000

> `npm run seed` creates demo businesses and prints credentials. Delete `data/` to reset.

## Demo accounts

All demo users share the password from `DEMO_PASSWORD` (default: `Repeato!2026`).

- Admin: `admin@repeato.local`
- Business owner: `priya@bluebird.test`
- Business staff: `arun@bluebird.test`
- Business owner: `daniel@urbanbrew.test`
- Customers: `asha@example.test`, `ravi@example.test`, `meera@example.test`

Join links:

- `/join/bluebird-coffee`
- `/join/urban-brew-cafe`

## Scripts

```bash
npm run dev
npm run build
npm start
npm test
npm run typecheck
npm run seed
npx playwright test
```

## Environment

Create `.env.local` from `.env.example` and set the required values.

- `DATABASE_URL` for PostgreSQL
- otherwise `DATABASE_PATH` for SQLite
- `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_PASSWORD`
- `PG_TEST_URL` for RLS tests

## Documentation

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md`
- `docs/KNOWN_LIMITATIONS.md`

## Repository status

This project is a working loyalty platform with demo data, role-based flows, and verification-focused logic. It is designed to be a realistic, testable prototype rather than a generic marketing landing page.

Built for trust, transparency, and operational clarity.
