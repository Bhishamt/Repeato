# Security

## Threat model

| Adversary | Goal | Primary control |
| --- | --- | --- |
| Customer with a QR code | Award themselves points | No client-writable points path; `recordPurchase` needs staff membership |
| Customer replaying a form | Double redemption or double award | Guarded status transitions, unique idempotency key, unique token |
| Business A owner | Read or act on business B | `business_id` scoping, `requireMember`, 403/404 on the QR route |
| Staff member | Escalate to owner actions | `requireMember(..., 'owner')` on team, settings, status changes |
| Anonymous | Enter a console or API | Layout guards + per-action guards, redirect to `/login?next=…` |
| Attacker with a stolen cookie | Long-lived access | 30-day expiry, hashed token at rest, httpOnly + SameSite=Lax + Secure in production |
| Credential stuffer | Bulk login | `scrypt` hashes, per-email login limit (8 / 10 minutes), generic error text |

## Authentication

- Passwords: `scrypt` with a per-user random salt, stored as `s1$<salt>$<hex>`; comparison uses
  `timingSafeEqual`. No plaintext, no reversibility, no fast hash.
- Sessions: 32 random bytes, sent as `rp_session`; only the SHA-256 hash is stored, so a database
  dump does not yield usable cookies.
- Cookie flags: `httpOnly`, `sameSite=lax`, `secure` when `NODE_ENV=production`, 30-day max age.
- Passwords are re-hashed on change, and the change deletes the account's sessions.
- Login errors do not distinguish "no such user" from "wrong password".
- `safeNext` only accepts relative paths, so `?next=` cannot become an open redirect.

## Authorisation

- `lib/auth.ts`: `requireUser`, `requireBusinessUser`, `requireAdmin` — each redirects to
  `/login?next=…` (or a role's home) instead of rendering.
- Route groups guard once per layout; **every** server action guards again — a layout guard alone
  would not protect a direct POST.
- Business actions resolve the requested `businessId`, verify the session user's membership, and
  fall back to the active business from the cookie only after that check.
- Owner-only operations (team management, business status, loyalty rules, staff removal) check
  `role = 'owner'`.
- Admin operations check `role = 'admin'`; suspension deletes the target's sessions.
- Detail pages re-verify ownership and call `notFound()` rather than returning a 403 that confirms
  a row exists.

## Money and points integrity

- Points are computed server-side from `lib/points.ts`, using the business's own rules read from the
  database inside the request. The browser never sends a points value.
- Money arrives as rupees from a form and is converted to integer paise with validation
  (`toPaise`); non-numeric, negative, or over-cap amounts are rejected.
- `recordPurchase` runs in `BEGIN IMMEDIATE` with `idempotency_key` unique; a double submit returns
  the first result.
- Reversal writes a compensating ledger row; nothing is deleted or edited.
- Redemption: balance ≥ minimum and ≥ cost, per-customer limit, guarded stock decrement, unique
  8-character token, `expires_at`, guarded status flip. Two simultaneous verifications cannot both
  succeed.
- Admin point adjustments require a reason and are recorded in the ledger (`kind='adjust'`) and the
  audit log.

## Tenant isolation

- `business_id` on every owned table; no query in the console omits it.
- Cross-tenant reads return `null` → `notFound()`; cross-tenant writes throw `DomainError(403)`.
- `/api/qr/[slug]`: 401 signed out, 403 for a non-member, 404 for an unknown slug. Verified in the
  browser suite (a business owner requesting another business's QR gets 403).
- Voucher verification is scoped by `business_id`, so a valid-looking token from another business
  fails.

## Transport and headers

`next.config.ts` sets `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy: camera=(self),
geolocation=(), microphone=()` and disables `X-Powered-By`. The QR route sends `Cache-Control:
private, no-store`.

## Input handling

- `lib/validate.ts` wraps `zod` schemas for email, password length, names, amounts, slugs, tokens.
- All SQL is parameterised (`better-sqlite3` prepared statements); there is no string interpolation
  of user input into SQL.
- React escapes rendered text; no `dangerouslySetInnerHTML` in the codebase.
- Business descriptions and reward terms are rendered as text, not HTML.

## Abuse limits

`lib/rate-limit.ts` is an in-process sliding window:

| Key | Limit |
| --- | --- |
| login per email | 8 per 10 minutes |
| signup per email | 5 per hour |
| contact form per email | 3 per hour |

Not covered: redemption and voucher verification. They require an authenticated member, and tokens
are random, but a determined staff account could brute-force tokens. Add a limiter (and Redis at
scale) before exposing the product publicly.

## Known gaps (also in KNOWN_LIMITATIONS.md)

1. **RLS is written but not running.** `supabase/migrations/0002_rls.sql` is the intended
   defence-in-depth layer; this build talks to SQLite through a trusted server process, so nothing
   exercises those policies yet.
2. **Rate limiting is per process.** Multiple instances = multiple buckets.
3. **No CSRF token.** Server Actions in Next 16 are POST-only and protected by the framework's
   origin checks plus `SameSite=Lax`; a custom token would be belt-and-braces.
4. **No email verification.** Anyone can register any address.
5. **No account deletion or data export.** Legally required in several jurisdictions; not built.
6. **No audit of read access.** Only writes are audited.
7. **No content security policy.** Headers above are the current baseline.
8. **No secret rotation tooling.** `ADMIN_PASSWORD` is printed once by the seed and stored hashed.
