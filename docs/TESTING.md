# Testing

## Commands

```bash
npm test              # Vitest — domain and service layer
npx playwright test   # browser flows (starts a dev server automatically)
npm run typecheck     # tsc --noEmit
npm run build         # production build
```

## Results from this build

| Gate | Result |
| --- | --- |
| `npm test` | **23 passed** (2 files, ~0.4 s) — `test/points.test.ts` 9, `test/services.test.ts` 14 |
| `npx playwright test` | **4 passed** (~11 s) — marketing routes, auth redirects, full join→sale→redeem→verify loop, tenant isolation |
| `npx tsc --noEmit` | exit 0, no output |
| `npm run build` | exit 0, `✓ Compiled successfully`, all app routes rendered dynamically |

These are the actual exits and counts produced by this repository, not targets.

## Unit tests — `test/points.test.ts` (9)

`lib/points.ts` is pure, so the tests are direct:

- per-hundred award (`₹480` at 10/100 → 48)
- minimum bill gate (`₹99` → 0 with a reason)
- per-transaction cap
- product overrides earn their own points and are excluded from the spend formula (no double count)
- fractional cents / non-integer amounts rejected
- zero and negative amounts rejected
- multiplier-free rules object identical to the seeded business defaults
- `nextRewardProgress` returns the cheapest affordable reward, remaining points and percent
- rounding is floor, never round-half-up that could overpay

## Integration tests — `test/services.test.ts` (14)

Run against a real database (`createTestDb(':memory:')`), real SQL, real transactions:

1. joining is idempotent and credits the bonus exactly once
2. joining a suspended business is refused
3. purchase below the minimum earns 0 points but is still recorded
4. purchase awards points and writes exactly one `earn` ledger row
5. replayed idempotency key returns the original purchase and does not change the balance
6. a staff member of another business cannot record a purchase (403)
7. a non-member cannot be paid points
8. reversal writes a compensating row and marks the purchase reversed
9. reversing twice is refused
10. redemption requires the business minimum balance
11. redemption decrements stock and writes a `redeem` row
12. redemption twice fails (balance already spent)
13. voucher verification succeeds once and fails the second time
14. cross-tenant voucher verification fails

Each test builds its own business, staff, customer and reward, so ordering cannot mask a failure.

## Browser tests — `e2e/smoke.spec.ts` (4)

Playwright drives the real app on `http://localhost:3000` (`webServer` in `playwright.config.ts`
starts it, `reuseExistingServer: true`):

1. **Marketing**: all 11 public routes return 200 and render more than 2,000 characters.
2. **Guards**: `/biz`, `/admin`, `/app`, `/biz/transactions` redirect signed-out visitors to
   `/login?next=…`.
3. **Money loop**: sign up from `/join/bluebird-coffee` with intent preserved → join → owner records
   a ₹1,500 sale → customer wallet shows the awarded points → redeem → 8-character token appears →
   staff accepts it → replay shows "already".
4. **Tenancy**: the Urban Brew owner sees Urban's menu and zero Bluebird products, and requesting
   Bluebird's QR returns a non-200 (401/403).

Screenshots and traces are captured on failure only.

## Why there is no React Testing Library suite

The brief asked for real tests; the highest-value tests here are the ones that exercise the domain
rules and the full browser path. Component-level tests would largely assert markup. The gap is
documented in `KNOWN_LIMITATIONS.md` rather than papered over with shallow snapshot tests.

## Manual review checklist

- Mobile 390 × 844: customer bottom nav reachable, no horizontal scroll, tap targets ≥ 40 px.
- Keyboard: skip affordance, visible focus ring (`:focus-visible`), forms submittable by keyboard.
- `prefers-reduced-motion`: transitions disabled by the global media query.
- Empty states: new business with no sales, customer with no points, no rewards, no vouchers.
- Error paths: wrong password, duplicate email, insufficient points, expired voucher, reversed sale.
