# Product requirements

## The brief

Build a complete, production-ready, multi-tenant customer loyalty and retention platform for
cafés and restaurants, with a public marketing site, a business console, a platform admin console,
and a separate mobile-first customer app.

Non-negotiables from the brief:

1. Marketing site with `/`, `/features`, `/how-it-works`, `/for-businesses`, `/pricing`, `/about`,
   `/contact`, `/login`, `/signup`, `/privacy`, `/terms` — no empty pages.
2. Supabase / Postgres backend with row level security.
3. A QR code per business pointing at `/join/<slug>`.
4. Staff-verified purchases. Points never computed in a browser, never accepted from one.
   Idempotent writes, an auditable ledger, reversals instead of edits.
5. Rewards redeemed with unpredictable, one-time tokens.
6. Business dashboard covering menu and categories, loyalty rules, rewards, transactions,
   redemptions, analytics, team, settings.
7. A separate, mobile-first customer app: home, businesses, wallet, rewards, history,
   notifications, profile.
8. Analytics computed from real rows only.
9. In-app notifications.
10. WCAG-conscious, responsive UI.
11. Real tests, a real production build, real documentation.
12. No invented metrics, testimonials, or pricing commitments.

## What was built

| Requirement | State | Where |
| --- | --- | --- |
| 11 marketing routes, all with real content | Done | `app/(marketing)/` |
| QR join per business | Done | `app/join/[slug]/page.tsx` |
| Staff-verified purchase, idempotent | Done | `recordPurchase` in `lib/services.ts` |
| Append-only ledger, derived balance | Done | `ledger` table, `getBalance` |
| Purchase reversal | Done | `reversePurchase` |
| Rewards + one-time tokens | Done | `redeemReward`, `verifyRedemption` |
| Business console, 12 sections | Done | `app/(business)/biz/` |
| Customer app, 7 sections, bottom nav | Done | `app/(customer)/app/` |
| Admin console | Done | `app/(admin)/admin/` |
| Analytics from real data | Done | `app/(business)/biz/analytics/page.tsx` |
| In-app notifications | Done | `notifications` table + `/app/notifications` |
| Supabase/Postgres schema + RLS | Written, not running | `supabase/migrations/` |
| Tests | 76 unit/integration (11 skipped without PG_TEST_URL), 4 browser flows | `test/`, `e2e/` |
| Production build | Passes | `npm run build` |
| Docs | 8 files | `docs/` |

## Product rules encoded in code

- **A scan identifies, it does not pay.** `/join/<slug>` has no amount field. The only paths that
  write an `earn` ledger row are `recordPurchase` and `joinBusiness` (signup bonus). Both require
  an authenticated actor and run server-side.
- **Points are integers.** Money is integer paise. No floats touch a balance.
- **The ledger is the source of truth.** Balances are `SUM(delta)`; there is no points column.
- **Reversal is compensating.** A reversed purchase keeps its row; a `reverse` ledger entry offsets
  it. History is never rewritten.
- **Tenant boundary.** Every business-owned table has `business_id`. Membership is checked per
  request. Cross-tenant access returns 404/403, never partial data.
- **Vouchers are single-use.** Redemption validates status, expiry and tenancy, then flips status
  with a guarded update; a second attempt fails.

## Deliberate non-goals for this build

- **No POS integration.** Nothing is claimed or faked. Sales are entered by staff, or a purchase is
  recorded against a customer the staff selects.
- **No payments or subscriptions.** The pricing page is illustrative; no billing code exists.
- **No email/SMS/push.** No provider was available, so there is no password reset, no email
  verification, and notifications stay in-app.
- **No phone OTP.** Requires an SMS provider.
- **No campaign engine / multiplier promotions.** Stable, tested per-business rules instead.
- **No self-serve data export or account deletion.** Documented as a gap, not hidden.

## Acceptance walkthrough (what a reviewer should try)

1. Open `/join/bluebird-coffee` signed out → sign up → land back on the join page → join → see the
   welcome bonus in the wallet.
2. Sign in as `priya@bluebird.test`, then `/biz/transactions`: record a sale for a member.
3. As that customer, `/app/rewards?b=bluebird-coffee`: redeem a reward, note the 8-character token.
4. As the owner, `/biz/redemptions`: accept the token once, then again — the second attempt is
   refused.
5. Sign in as `daniel@urbanbrew.test`: the Bluebird menu, customers and QR are absent.
6. Signed out, hit `/biz`, `/admin`, `/app` — all redirect to `/login?next=…`.
