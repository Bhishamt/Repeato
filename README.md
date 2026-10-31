# Repeato

Repeato is a loyalty and retention platform built for cafés, restaurants, and hospitality businesses that want a more structured way to keep customers engaged.

A customer joins a business by scanning a QR code, becomes a member once, and earns points when staff record a verified purchase. Those points can later be converted into rewards and one-time vouchers that are redeemed at the counter.

The product is designed around one critical rule:

> A QR scan never awards points.

Scanning only identifies the business. The point balance is created only by the server after a valid purchase is recorded by staff. This keeps the system secure, auditable, and resistant to manipulation.

---

## What Repeato is

Repeato is a multi-tenant loyalty platform for businesses that need:

- customer membership via QR code
- staff-verified purchases
- points earned from real transactions
- reward and voucher tracking
- role-based access for admins, owners, staff, and customers
- analytics and customer engagement data
- a secure ledger-based balance system instead of simple mutable points values

It is designed for real-world businesses with physical operations, especially:

- cafés
- coffee shops
- restaurants
- quick-service counters
- retail loyalty programs with in-person redemption

---

## What Repeato does

### For customers
Customers can:

- scan a business QR code
- join once as a member
- track points
- view reward eligibility
- redeem vouchers
- check purchase and activity history
- see progress toward loyalty tiers

### For business staff
Staff can:

- record customer purchases
- validate exact amounts
- write points to the customer account
- redeem customer vouchers
- see customer history and membership status
- handle purchases without trusting browser-side calculation

### For business owners
Owners can:

- manage loyalty rules
- create or edit rewards
- view business analytics
- inspect customer engagement
- track redemptions and transactions
- manage staff access and settings

### For admins
Admins can:

- manage multiple businesses
- review users and onboarding
- inspect audit logs
- monitor platform operational data
- manage tenant-level permissions and governance

---

## How Repeato works

The core flow is straightforward:

1. A customer scans a business QR code.
2. The app identifies which business the code belongs to.
3. The customer joins that business once.
4. Staff record a purchase for that customer.
5. The server validates the purchase and writes a points entry.
6. The customer balance is calculated from ledger data.
7. The customer can redeem rewards if eligible.
8. Redeemed vouchers are marked as used, preventing double redemption.
9. Reversals are tracked rather than silently deleted.

This means the system is built around trustworthy server-side logic instead of relying on client-side data.

---

## Product rule: why this matters

The most important design rule is:

> A QR scan never awards points.

This rule is critical because it prevents fake point increases and browser manipulation. The app never accepts a customer’s “balance” from the browser and trusts it blindly. Instead:

- the browser identifies a business
- the server validates the purchase
- the server writes ledger entries in a transaction
- the balance is derived from authorized records

This is a safer and more realistic model for a real loyalty system.

---

## Architecture

Repeato is structured as a modern web app with a clear separation of responsibilities.

### Frontend
The app uses:

- Next.js
- React
- TypeScript
- Tailwind CSS

This powers:

- marketing pages
- customer app screens
- business console screens
- admin dashboards
- QR-based onboarding and join flows

### Backend and business logic
Server-side logic handles:

- membership validation
- purchase verification
- loyalty rules
- points calculation
- reward generation
- voucher redemption
- role enforcement
- tenant data isolation

This logic runs in trusted backend code rather than the browser.

### Database layer
The app supports multiple database backends through a single abstraction layer:

- SQLite for local development
- PostgreSQL for production-like or CI environments

This allows the same logic to operate across both environments without rewriting the business model.

---

## System flow diagram

```mermaid
flowchart TD
    A[Customer scans QR code] --> B[Business identified]
    B --> C[Customer joins business]
    C --> D[Staff records purchase]
    D --> E[Server validates transaction]
    E --> F[Ledger entry writes points]
    F --> G[Customer balance recalculated]
    G --> H[Reward eligibility checked]
    H --> I[Reward voucher created]
    I --> J[Voucher redeemed once]
    J --> K[Audit history preserved]
```

---

## Data model philosophy

Repeato does not rely on a single mutable “points” field that can drift out of sync.

Instead, the system uses a ledger-based approach:

- every action is recorded as an event
- points are derived from ledger entries
- purchases and reversals are tracked
- balances can be recalculated consistently
- the history stays intact for auditing

This creates a much stronger foundation for trust and operations.

For example:

- when a purchase is recorded, a ledger entry is created
- when a reward is redeemed, a status change is recorded
- when a purchase is reversed, a compensating ledger entry is written
- the system maintains an audit trail instead of deleting history

This makes the product far more operationally sound than a simple point counter.

---

## Rewards and vouchers

Repeato supports:

- points generated from purchases
- reward tiers and business-specific offers
- voucher creation
- expiration rules
- single-use redemption
- status transitions for redeemed or expired vouchers

A reward becomes a one-time voucher, which is validated and redeemed securely. Redeeming twice is prevented by the server.

---

## Loyalty tiers

The system supports loyalty progression with tiers such as:

- Bronze
- Silver
- Gold
- Platinum

Tiers can include:

- threshold-based progression
- spend-based qualification
- point multipliers
- reward discounts
- upgrade progress tracking

This gives businesses a way to reward repeat customers and encourage higher lifetime value.

---

## Security model

Repeato is designed around secure server-side rules.

Key security principles:

- no trusted browser-side point updates
- server-side validation for all changes
- role-based access checks
- membership validation before reward or point actions
- tenant isolation between businesses
- idempotency protection for duplicate submissions
- audit-friendly ledger tracking

This model reduces many common flaws in loyalty software where client-side data is treated as truth.

---

## Roles

The platform supports four core roles:

- `admin`
- `owner`
- `staff`
- `customer`

Each role has distinct permissions, and the UI and server logic both enforce them.

---

## Main features

- QR-based member onboarding
- staff-verified purchase recording
- secure point issuance
- reward and voucher lifecycle
- customer wallet and activity tracking
- business analytics
- multi-tenant operations
- role and permission enforcement
- CSV or reporting support
- validation and formatting utilities
- clear separation of service logic from UI logic

---

## Tech stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- SQLite for local development
- PostgreSQL for production-like use
- Vitest for tests
- Playwright for browser testing
- Recharts for charts and analytics

---

## Repository layout

```text
.
├─ app/
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

---

## Quick start

### Install Node.js
Use Node.js 22 or newer.

#### Windows
Install Node.js from the official website or use `nvm-windows`:

```powershell
nvm install 22
nvm use 22
```

#### macOS
Use Homebrew or nvm:

```bash
brew install node@22
```

or:

```bash
nvm install 22
nvm use 22
```

### Clone the project

```bash
git clone https://github.com/Bhishamt/Repeato.git
cd Repeato
```

### Install dependencies

```bash
npm install
```

### Create environment file

```bash
cp .env.example .env.local
```

### Seed demo data

```bash
npm run seed
```

This creates demo businesses and sample users.

### Run the app

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## Local setup for Windows and Mac

### Windows
1. Install Node.js 22
2. Open PowerShell or Command Prompt
3. Clone the repo
4. Run `npm install`
5. Copy `.env.example` to `.env.local`
6. Run `npm run seed`
7. Run `npm run dev`

Useful commands:

```powershell
npm install
npm run seed
npm run dev
npm run build
npm test
```

### macOS
1. Install Node.js 22
2. Open Terminal
3. Clone the repo
4. Run `npm install`
5. Create `.env.local`
6. Run `npm run seed`
7. Run `npm run dev`

Useful commands:

```bash
npm install
npm run seed
npm run dev
npm run build
npm test
```

---

## Database setup

### SQLite
This is the easiest local setup:

- no external database required
- best for development and testing
- uses a local file in `data/`

### PostgreSQL
For production-like local testing:

```bash
export DATABASE_URL="postgres://postgres:postgrespassword@localhost:5432/repeato_ci"
```

Then:

```bash
node scripts/migrate.mjs --local
```

This is used in CI and production-like verification workflows.

---

## Demo accounts

The seeded data includes demo users for testing.

Default password is read from `DEMO_PASSWORD`, often:

```text
Repeato!2026
```

Example accounts:

- Admin: `admin@repeato.local`
- Business owner: `priya@bluebird.test`
- Business staff: `arun@bluebird.test`
- Business owner: `daniel@urbanbrew.test`
- Customers: `asha@example.test`, `ravi@example.test`, `meera@example.test`

Demo join links:

- `/join/bluebird-coffee`
- `/join/urban-brew-cafe`

---

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

---

## Environment variables

The app expects values such as:

- `DATABASE_URL`
- `DATABASE_PATH`
- `APP_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `DEMO_PASSWORD`
- `PG_TEST_URL`

These are typically configured in `.env.local`.

---

## Documentation

The repository also contains deeper guidance:

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md`
- `docs/KNOWN_LIMITATIONS.md`

---

## Summary

Repeato is a loyalty platform built around real operational logic, not fake browser-only metrics. It is designed to help cafés and restaurants keep customers engaged by combining QR onboarding, verified transactions, secure points issuance, and single-use reward flows.

The software is intentionally built around trust, auditability, and clear server-side enforcement so that point accrual and redemption remain accurate and difficult to manipulate.

This is a practical platform for real business operations, not a simple gimmick or toy prototype.
