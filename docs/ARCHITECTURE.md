# Architecture

## Shape

```
Browser
  ├─ marketing / auth routes        (static-ish server components)
  ├─ /app  customer shell           (bottom nav, mobile-first)
  ├─ /biz  business console         (sidebar, desktop-first)
  └─ /admin console
        │
        │  forms post to Server Actions ("use server")
        ▼
app/actions/*.ts        thin adapters: parse FormData → validate → call service → redirect
        │
        ▼
lib/services.ts         ALL domain logic, explicit transactions, tenancy checks, audit/notify
        │
        ▼
lib/db.ts (better-sqlite3)   ← lib/schema.ts (DDL)
        │
        └── production target: supabase/migrations (Postgres + RLS)
```

There is no client-side data fetching and no API surface for mutations. The only route handler in
the app is `app/api/qr/[slug]/route.ts`, which renders a PNG.

## Layers and why they exist

| Layer | Files | Responsibility |
| --- | --- | --- |
| Presentation | `app/**`, `components/**` | Server components render rows; client components exist only where interaction demands it (`sale-form`, `qr-actions`, `points-preview`, `trend-chart`, nav link) |
| Actions | `app/actions/{auth,business,customer,admin,contact}.ts` | Session gate, `FormData` parsing, `zod`-backed validation from `lib/validate.ts`, redirect with `?ok=`/`?error=` |
| Domain | `lib/services.ts` | Every write. Membership, business status, points, ledger, tokens, idempotency, audit, notifications |
| Rules | `lib/points.ts` | Pure functions: points from amount/rules/lines, next-reward progress |
| Persistence | `lib/db.ts`, `lib/schema.ts` | Singleton connection, WAL, FK enforcement, DDL |
| Auth | `lib/auth.ts`, `lib/password.ts` | Session cookie, hashed session tokens, scrypt passwords, `requireUser`/`requireBusinessUser`/`requireAdmin`, membership helpers |
| Presentation helpers | `lib/format.ts`, `components/ui.tsx` | Money/points/date formatting, `withQuery`, Pill/Alert/Empty/Stat primitives |

Actions never compute money or points; components never see a balance they can submit.

## Route protection

No `middleware.ts`. Each route group layout calls the guard once and every action re-checks:

- `app/(customer)/layout.tsx` → `requireUser('/app')`, then role `customer` (a business user is
  redirected to `/biz`, an admin to `/admin`).
- `app/(business)/layout.tsx` → `requireBusinessUser('/biz')` plus `activeMembership`.
- `app/(admin)/layout.tsx` → `requireAdmin('/admin')`.
- Every action in `app/actions/business.ts` goes through `handle()`, which resolves the requested
  `businessId`, calls `requireMember`, and refuses a business the session user does not belong to.

Redirects always preserve intent: `/login?next=<path>`, sanitised by `safeNext` so only relative
paths survive.

## Key flows

### Join

`GET /join/<slug>` → business by slug (active only, suspended shows a closed state) → if signed in
and already a member, show balance and next reward → otherwise form posts `joinFromQr` →
`joinBusiness` inserts `business_customers` (INSERT OR IGNORE), credits `signup_bonus` as a `bonus`
ledger row when newly joined, notifies, audits, redirect `?joined=1&bonus=N`.

### Purchase

`components/sale-form.tsx` (client) posts `recordSale` with hidden `businessId`, `back`, and a
`crypto.randomUUID()` idempotency key. `recordPurchase`:

1. `requireMember(actor, businessId)`; business must not be suspended.
2. Customer must be a member of that business.
3. Amount: integer, 1 … ₹2,00,000; optional lines must sum to the amount.
4. `calculatePoints` applies the per-business rules, per-product overrides, and the transaction cap.
5. Single `BEGIN IMMEDIATE`: check `idempotency_key` (return the existing purchase if present),
   insert `purchases`, insert `ledger` (`kind='earn'`), audit, notify.

Reversals call `reversePurchase`, which marks the purchase `reversed` and writes a negative
`reverse` ledger row in the same transaction — no row is deleted.

### Redemption

`redeem` → `redeemReward` inside `BEGIN IMMEDIATE`: membership, business active, reward active and
in date, balance ≥ `min_redeem_points` and ≥ cost, per-customer limit, guarded stock decrement
(`WHERE stock > 0`), 8-character token unique by retry, `expires_at +14 days`, `redeem` ledger row,
notification, audit. Redirect to `/app/vouchers?issued=<token>`.

`verifyVoucher` (staff) → `verifyRedemption`: membership on the voucher's business, token
uppercased, status must be `issued` and not expired, guarded transition to `redeemed` with
`redeemed_by` and `redeemed_at`. Second attempt throws `DomainError`, surfaced as an error banner.

### Analytics

`/biz/analytics` aggregates directly: daily verified purchase counts and revenue for 30 days, top
customers by visits and spend, per-category mix, redemption rate. Every number is a SQL aggregate
over rows the business owns; empty states say so instead of showing fake trends.

## Multi-tenancy

Every business-owned table stores `business_id`. Reads in the console always filter by the active
business resolved from membership (`activeMembership` reads a cookie, falls back to the first
membership). Detail routes re-verify: `storeForUser`-style helpers in the service layer return
`null` for a row owned by someone else, and the page calls `notFound()`.

The QR endpoint is tenant-private: 401 without a session, 403 when the caller is neither an admin
nor a member of that business, 404 for an unknown slug.

## Error handling

- `DomainError(message, status)` is the only expected failure type from services; actions catch it,
  redirect with the message, and never leak stack traces.
- Unexpected errors bubble to Next's error boundary.
- Next control-flow exceptions (`NEXT_REDIRECT`) are re-thrown explicitly with
  `unstable_rethrow` in customer actions — without it a `catch` swallows a successful redirect and
  reports a failure after the write already committed.

## Design system

Tailwind 4 with tokens in `app/globals.css` (`@theme`): paper/ink palette, brand green
`#17553f`, copper accent `#b4653a`, Fraunces display + Inter body, mono for codes and labels.
Component classes (`.btn`, `.card`, `.pill`, `.field`, `.wrap`) are defined once in
`@layer components`. The brief's "premium, not templated" requirement is met with typography and
spacing discipline rather than animation; motion respects `prefers-reduced-motion`.
