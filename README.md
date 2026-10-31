# Repeato

A modern loyalty and retention platform for cafés and restaurants.

Repeato helps a business turn casual customers into repeat visitors by letting them join via a QR code, earn points from verified purchases, and redeem rewards in a controlled, auditable way.

The core idea is simple: a customer does not get points just by scanning a QR code. A QR scan identifies the business and starts the membership flow. Points are created only when staff record a valid purchase on the server.

This design keeps the system safe, consistent, and difficult to abuse.

## What Repeato is

Repeato is a multi-tenant SaaS-style loyalty app built for businesses that want:

- customer membership via QR or direct join links
- staff-verified purchases
- points earned from real transactions
- one-time reward vouchers
- secure loyalty tracking across multiple businesses
- separate experiences for customers, staff, owners, and admins

It is designed for real-world hospitality operations, especially cafés, coffee shops, restaurants, and snack counters that need simple loyalty logic without messy spreadsheet-based tracking.

## What it does

### For customers

Customers can:

- join a business from a QR code or landing page
- see their balance and reward status
- redeem eligible vouchers
- track purchases and activity history
- view loyalty tier progress and benefits

### For business staff

Staff can:

- record purchases for members
- validate the sale amount
- apply points and ledger rules in one transaction
- redeem vouchers at the counter
- view customer and business activity

### For business owners

Owners can:

- manage loyalty rules and rewards
- view customer engagement and transaction history
- inspect analytics and business performance
- control team access and business settings

### For platform admins

Admins can:

- manage businesses
- review users and onboarding status
- inspect audit logs
- monitor platform activity and operations

## How it works internally

Repeato follows a very clear pattern:

1. A customer scans a QR code for a business.
2. The app identifies the business and creates or confirms a membership.
3. Staff record a purchase for that customer.
4. The server validates the purchase and writes points through a ledger.
5. The customer’s balance is computed from ledger entries, not stored as a mutable field.
6. Rewards are created and converted into single-use vouchers.
7. Vouchers are redeemed by staff and marked as completed once used.

This is more secure than storing a simple “points balance” value that can drift or be overwritten.

## Core business rule

The most important rule in the product is:

> A QR scan never awards points.

Scanning only identifies the business. Points are created only on the server after a valid purchase is recorded. This prevents fake or forged point increases from the browser.

## System flow diagram

```mermaid
flowchart TD
    A[Customer scans QR code] --> B[Join or verify membership]
    B --> C[Business customer record created]
    C --> D[Staff records purchase]
    D --> E[Server validates sale]
    E --> F[Ledger entry writes points]
    F --> G[Customer balance recalculated]
    G --> H[Reward eligibility checked]
    H --> I[Voucher generated / redeemed]
    I --> J[Audit trail and history preserved]
```

## Architecture overview

Repeato is built as a Next.js application with a clear separation between:

- user-facing app routes
- server-side business logic
- database abstraction layer
- validation and formatting utilities
- tests and automation

### Frontend

The UI uses:

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS

This powers:

- customer app screens
- business console screens
- admin dashboards
- marketing pages and onboarding flows

### Backend and business logic

Business actions are handled through server-side logic and service layers. This keeps rules such as:

- role checks
- membership validation
- purchase verification
- points calculation
- reward issuance
- redemption rules

in one secure place rather than trusting browser input.

### Database layer

The database layer exposes a single interface while supporting two backends:

- SQLite for development and local testing
- PostgreSQL for production-like and CI environments

The app uses an abstraction layer so the same logic works across both databases.

## Data model philosophy

Repeato uses a ledger-style model instead of a simple points column.

### Why ledger-based tracking matters

Instead of storing one mutable value like `customer.points`, the app records entries with deltas. This makes the system:

- auditable
- less error-prone
- easier to reverse
- safer for reconciliation

When a purchase is recorded, the app adds a ledger row. When it is reversed, it creates a compensating entry instead of deleting history.

This creates a reliable trail of activity and protects the business from incorrect or manipulated balances.

## Rewards and vouchers

The platform supports:

- points earned from purchases
- business-specific rewards
- one-time vouchers
- expiry rules
- redemption validation
- reversal-safe status transitions

Each reward becomes a voucher that is only redeemable once, and the system checks status transitions carefully to prevent duplicate redemptions.

## Loyalty tiers

Repeato includes a tier system with progression rules such as:

- Bronze
- Silver
- Gold
- Platinum

Each tier can include:

- minimum point thresholds
- spend thresholds
- discount multipliers
- bonus point accelerators
- upgrade progress tracking

The tier logic is centralized in the points-related utilities so it behaves consistently across the app.

## Security model

Repeato is designed around secure server-side authority.

Key security principles:

- browser input is never trusted for financial changes
- ownership and role checks happen server-side
- membership is validated before state changes
- duplicate operations are blocked via idempotency checks
- ledger history remains intact for reversals
- tenant isolation prevents cross-business access

## User roles

The system supports four primary roles:

- `admin`
- `owner`
- `staff`
- `customer`

Each role has different permissions and data access rules. Role checks are enforced on the server, not just the UI.

## Key features

- QR-based member onboarding
- real purchase verification
- ledger-based point accounting
- reward conversion and vouchers
- customer history and wallet flows
- business analytics and reporting
- team management and settings
- admin oversight and audit logs
- CSV export support with sanitation for safety
- validation and formatting utilities for core business identifiers

## Tech stack

- Next.js 16
- App Router
- React 19
- TypeScript strict mode
- Tailwind CSS
- SQLite with `better-sqlite3`
- PostgreSQL with `pg`
- Vitest for unit and service tests
- Playwright for browser testing
- Recharts for charting

## Repository structure

```text
.
├─ app/
│  ├─ (marketing)/
│  ├─ app/
│  ├─ biz/
│  ├─ admin/
│  ├─ join/
│  └─ globals.css
├─ components/
├─ lib/
│  ├─ auth.ts
│  ├─ db.ts
│  ├─ points.ts
│  ├─ services.ts
│  ├─ validate.ts
│  ├─ format.ts
│  └─ csv.ts
├─ scripts/
├─ test/
├─ docs/
├─ public/
├─ data/
├─ .env.example
├─ package.json
├─ README.md
└─ next.config.*
```

## Quick start

### 1. Install Node.js

Use Node.js 22 or newer.

#### Windows

- Install Node.js 22 from the official Node website
- Or use `nvm-windows`:

```powershell
nvm install 22.20.0
nvm use 22.20.0
```

#### macOS

```bash
brew install node@22
nvm install 22
nvm use 22
```

You can also use `fnm` or `Volta` for version management.

### 2. Clone the project

```bash
git clone https://github.com/Bhishamt/Repeato.git
cd Repeato
```

### 3. Install dependencies

```bash
npm install
```

### 4. Create environment file

```bash
cp .env.example .env.local
```

If you do not want to edit the file manually yet, at minimum make sure the app has a valid database configuration.

### 5. Start with demo data

```bash
npm run seed
```

This creates a local demo database and prints login credentials.

### 6. Run the app

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Local database setup

### SQLite (default for local development)

This is the easiest setup for personal use.

- the app uses the local database file under `data/`
- it is good for demos and local verification
- no external database server is required

### PostgreSQL

For a more production-like setup:

```bash
export DATABASE_URL="postgres://postgres:postgrespassword@localhost:5432/repeato_ci"
```

Then run:

```bash
node scripts/migrate.mjs --local
```

You can also use the included PostgreSQL helper script for local service setup.

## Demo accounts

The seeded demo data includes several users with test access.

Default password is from `DEMO_PASSWORD` and usually defaults to:

```text
Repeato!2026
```

Example accounts:

- Platform admin: `admin@repeato.local`
- Business owner: `priya@bluebird.test`
- Business staff: `arun@bluebird.test`
- Business owner: `daniel@urbanbrew.test`
- Customers: `asha@example.test`, `ravi@example.test`, `meera@example.test`

Demo join links:

- `/join/bluebird-coffee`
- `/join/urban-brew-cafe`

## Production mindset

This project does not treat point issuance as a client-side operation. It is server-controlled, transaction-safe, and traceable.

That makes the app much closer to a real operational product than a toy loyalty demo.

## Useful scripts

```bash
npm run dev        # run local app
npm run build      # production build
npm start          # serve production build
npm test           # run project tests
npm run typecheck  # TypeScript validation
npm run seed       # generate demo data
npx playwright test # run UI/browser tests
```

## Environment variables

The app expects environment values such as:

- `DATABASE_URL` for PostgreSQL
- `DATABASE_PATH` for SQLite
- `APP_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `DEMO_PASSWORD`
- `PG_TEST_URL` for test database access

You can set these in `.env.local`.

## Documentation

The repo includes deeper project documentation here:

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md`
- `docs/KNOWN_LIMITATIONS.md`

## Summary

Repeato is a loyalty platform built to be practical and auditable. It is not just a points widget. It is a full operational flow for membership onboarding, purchase verification, reward issuance, redemption, and secure ledger-based tracking.

If you want a version of this README that is even more polished for GitHub with badges, a feature grid, and a landing-page style hero section, I can generate that next.
