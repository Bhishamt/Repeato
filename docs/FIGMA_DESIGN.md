# Design specification

## About the Figma file

**There is no Figma file, and none is claimed.** The Figma MCP server was reachable and
authenticated (`whoami` returned the account "collage woork"), but the seat on that Starter team is
**View**, and `create_new_file` failed with:

> Looks like you don't have edit access to this file. The file owner can share it with you and make
> you an editor.

This document is the specification that would produce it. Everything below is implemented in
`app/globals.css` and the route files, so the running app is the reference implementation. To create
the Figma counterpart: invite an editor seat, then build a library from these tokens and the screen
inventory at the end of this file.

## Tokens

Defined once in `app/globals.css` under `@theme` (Tailwind 4 CSS-first config).

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#faf7f1` | page background |
| `paper-deep` | `#f2ece1` | alternating section, table header |
| `ink` | `#17130f` | primary text |
| `ink-soft` | `#443c34` | secondary text |
| `muted` | `#746a5f` | labels, meta, captions |
| `line` | `#e6ded1` | borders, dividers |
| `brand` | `#17553f` | primary actions, brand marks |
| `brand-deep` | `#0f3d2d` | hover / pressed |
| `brand-soft` | `#e4efe8` | selected rows, soft badges |
| `copper` | `#b4653a` | accent, eyebrow labels, highlights |
| `copper-soft` | `#f7e8de` | accent surfaces |
| `amber` | `#c98a2b` | pending |
| `danger` | `#a93629` | destructive, errors |

Each business carries its own `brand_color` (Bluebird `#17553f`, Urban Brew `#8a4b1f`), used for that
business's card stripe and avatar so the customer can tell businesses apart at a glance.

Semantic status colours are never the only signal: every status is a text label inside a pill
(`.pill-ok`, `.pill-warn`, `.pill-bad`, `.pill-muted`, `.pill-brand`).

### Type

| Role | Family | Size / weight |
| --- | --- | --- |
| Display | Fraunces (variable serif) | `clamp(2rem, 4vw, 3.4rem)` / 600, `letter-spacing: -0.02em`, `line-height: 1.05` |
| Body | Inter | 16 px / 400, `line-height: 1.6` |
| Small | Inter | 14 px / 400–500 |
| Eyebrow / label | Mono (`ui-monospace`) | 11–12 px, `letter-spacing: 0.16em`, uppercase |
| Numeric | Inter tabular | `font-variant-numeric: tabular-nums` for money and points |

Headings 1–4 use the display face; everything functional is sans. Codes, tokens, slugs and amounts in
tables use the mono face.

### Space, radius, elevation

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px (Tailwind defaults).
- Container: `.wrap` max-width 1180 px, 20 px inline padding, 32 px from `md`.
- Radius: 10 px controls, 14 px cards, `9999px` pills.
- Elevation: one soft shadow for cards (`0 1px 2px rgba(23,19,15,.06)`); nothing floats.
- Borders do the dividing work: 1 px `line`.

### Motion

- 150 ms ease for state changes (button colour, focus), 200 ms for `fade-up` entrances.
- `.fade-up`, `.fade-up-2`, `.fade-up-3` stagger hero content only.
- `prefers-reduced-motion: reduce` sets all durations to ~0 and disables smooth scrolling — global,
  in `@layer base`.

## Components

| Component | Notes |
| --- | --- |
| `.btn` + `-primary` / `-accent` / `-ghost` / `-soft` / `-sm` / `-block` | 42 px min height, 10 px radius, 150 ms transition, `:active` 1 px push |
| `.card`, `.card-pad`, `.card-quiet` | 14 px radius, `line` border, white or paper background |
| `.field`, `.label`, `.input`, `.select`, `.textarea`, `.hint`, `.error-text` | one vertical rhythm for every form |
| `.pill` variants | status only, always with a word |
| `.table`, `.table-wrap`, `.scroll-x` | tables scroll horizontally on mobile instead of compressing |
| `.kpi`, `.kpi-label`, `.kpi-value`, `.kpi-sub` | console metrics |
| `.alert` variants | inline feedback after an action, `role="status"` / `role="alert"` |
| `.empty` | every list has one, with the next action as a link |
| `.progress` | points toward the next reward |
| `.sidebar-link` + `[aria-current="page"]` | business and admin consoles |
| `.link`, `.divide-line`, `.mono`, `.eyebrow`, `.display` | text utilities |

Primitive React components in `components/ui.tsx`: `Wordmark`, `Pill`, `Alert`, `Empty`, `Stat`,
`SectionTitle`, `Progress`, `Field`. Money and points are formatted by `money()` / `points()` in
`lib/format.ts`, not components. Icons from Lucide, 16–20 px, stroke 1.75.

## Layouts

| Surface | Frame | Notes |
| --- | --- | --- |
| Marketing | 1180 px container, 12-column mental grid | hero is 7/5 text + visual; sections separated by 1 px rules, not cards everywhere |
| Customer app | max 560 px content, fixed bottom nav (5 tabs: Home, Rewards, Wallet, Vouchers, Profile) | primary action within thumb reach; desktop shows the same tabs as pills in the header |
| Business console | 248 px sidebar + fluid main, max 1180 px | sidebar collapses to a horizontal scroller under 1024 px |
| Admin console | same shell as business, copper-tinted eyebrow | read-mostly tables |

## Screen inventory

### Marketing (11)

`/` hero + how it works + proof-by-mechanism + FAQ + CTA · `/features` · `/how-it-works` (three
steps with the scan-never-pays rule stated) · `/for-businesses` · `/pricing` (illustrative tiers,
clearly not a commitment) · `/about` · `/contact` (form + honest response expectations) · `/privacy` ·
`/terms` · `/login` · `/signup` (customer or business variant).

### Auth and join

`/onboarding` (role choice) · `/join/<slug>`: business header with brand stripe, "Scanned" pill,
earning rules strip, member balance + next-reward progress, or join CTA with bonus.

### Customer app (7)

Home (balance, nearest reward, recent activity) · Businesses (directory, join state) · Wallet
(balance, ledger preview, earn rules) · Rewards (per business, affordability states) · Vouchers
(8-character token, expiry) · Activity (paginated ledger) · Notifications (unread first) · Profile
(name, phone, password, sign out).

### Business console (12)

Dashboard (KPIs, recent sales, pending redemptions) · Transactions (record sale, history, reverse) ·
Customers (list, search) · Customer detail (balance, ledger, adjust with reason) · Loyalty (points per
₹100, minimum bill, cap, signup bonus, minimum redeem) · Menu & categories (CRUD, per-product points
override) · Rewards (create, stock, pause) · Redemptions (accept voucher, history) · QR (downloadable
PNG, printable) · Analytics (30-day trend, top customers, category mix) · Team (invite staff, remove)
· Settings (name, category, address, brand colour, status read-only).

### Admin (4)

Overview (businesses, users, points issued) · Businesses (approve, suspend) · Users (roles, status) ·
Audit (append-only event list with actor and metadata).

## Accessibility rules applied

1. Every interactive element is a real `button`/`a`/input, never a clickable `div`.
2. Focus is visible: `:focus-visible` gets a 2 px brand outline with 2 px offset.
3. Status is text plus colour, never colour alone.
4. Form errors are rendered next to the field and announced (`role="alert"`); success uses
   `role="status"`.
5. Tables are wrapped in a scroll container so they never break the layout at 390 px.
6. Charts carry a title/`aria-label` summary; the underlying numbers are also available as text.
7. Motion is optional: reduced-motion users get none.
8. Tap targets are at least 40 px on the customer app; the bottom nav is 56 px plus safe-area inset.
9. Colour pairs used for body text (ink on paper, white on brand) exceed 4.5:1; muted text is used
   for labels at 14 px and above.
