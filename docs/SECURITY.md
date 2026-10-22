# Security

Last reviewed: 23 October 2026. Every claim below was checked by running the code, not by reading a
checklist. Where something is missing it is listed under **Open risks** instead of being implied.

## Authentication

- Passwords are hashed with `scrypt` (`lib/password.ts`) using a per-user salt and verified with a
  timing-safe comparison. Plaintext is never stored or logged.
- Sessions are opaque 32-byte tokens. Only the SHA-256 hash is stored (`sessions.token_hash`), so a
  database leak does not hand over live sessions.
- The session cookie (`rp_session`) is `httpOnly`, `sameSite=lax`, `path=/`, `secure` when
  `NODE_ENV=production`, and expires after 30 days.
- Sessions can be revoked per device (`endSession`) or for every device (`revokeUserSessions`, used on
  password change and on suspension by an admin).
- Login and signup are rate limited per email: 8 attempts / 10 minutes and 5 / hour.
- Sign-in failures do not reveal whether an email exists.

## Authorisation

- Every protected layout calls `requireBusinessUser` / `requireAdmin` / `requireUser`; every server
  action re-derives the caller from the session cookie rather than trusting form fields.
- Tenant isolation is enforced twice: `requireMember(db, userId, businessId)` before each write in
  `lib/services.ts`, and `business_id` predicates on every query. A business id belonging to someone
  else is indistinguishable from a missing record.
- Staff can record sales, verify vouchers and manage the menu. Owner-only actions (reversals, point
  adjustments, team management, business settings) check `need: "owner"` inside `handle()`.
- Admin actions call `requireAdmin` and cannot target admin accounts for suspension, which prevents
  privilege escalation through the console.
- The QR download route (`/api/qr/[slug]`) re-checks membership server-side; a non-member receives
  403. This was a real bug found by the E2E suite after the async refactor (`!promise` is always
  false) and is now covered by a test.

## Database-level isolation (PostgreSQL)

`supabase/migrations/0002_rls.sql` enables row-level security on every table with policies keyed on
`request.jwt.claims`. `test/pg-rls.test.ts` exercises them against a real PostgreSQL 18.4 server as
four different identities (owner, staff, customer, admin): 11 assertions, all passing. They cover
cross-tenant reads, cross-tenant writes, ledger privacy, admin read-all, single-owner business claims
and owner-only team management.

The application itself connects as the database owner, so RLS is not what protects the app — the
service layer is. RLS protects any future direct client (PostgREST, mobile app, edge function). If you
connect as the owner from a public client you lose that protection entirely; see `docs/DEPLOYMENT.md`.

## Money and points integrity

- Balances are never stored as a mutable number: `balance = SUM(ledger.delta)`, and ledger rows are
  append-only. Reversals and adjustments add rows rather than editing history.
- `purchases.idempotency_key` is `UNIQUE`. Five concurrent submissions of the same key produce one
  purchase and one award — asserted in `test/services.test.ts`.
- Redemption runs inside a transaction that re-reads the balance, decrements stock with
  `WHERE stock > 0`, and writes the ledger row. Three concurrent attempts against a balance that
  funds one produce exactly one voucher — asserted in the same suite.
- Voucher tokens are 8 characters from a 32-character alphabet (~2^40) and are `UNIQUE`; they expire
  after 14 days and can be verified once (`UPDATE ... WHERE status = 'issued'`).
- Money is integer paise, points are integers. No floats touch either.

## Transport and browser hardening

Headers set in `next.config.ts` for every route:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'
  'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';
  frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: SAMEORIGIN
Permissions-Policy: camera=(self), geolocation=(), microphone=()
Strict-Transport-Security: max-age=31536000; includeSubDomains   (production only)
```

`'unsafe-inline'` is required because Next injects inline bootstrap scripts and Tailwind emits inline
styles; a nonce-based policy would need middleware and is listed as future work. `'unsafe-eval'` is
added in development only, because the dev server needs it.

## CSRF

State-changing requests are Next.js server actions, which Next rejects unless the request's `Origin`
matches the host, and the session cookie is `SameSite=Lax`, so a cross-site form post carries no
credentials. There is no REST surface that mutates state — the only route handler (`/api/qr/[slug]`)
is a `GET`. If you add a mutating route handler later, add an explicit origin check and a CSRF token.

## Rate limiting

`lib/rate-limit.ts` is a fixed-window limiter with two stores:

- **Shared (production):** if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, counters
  live in Redis via `INCR` + `PEXPIRE`, so every instance shares them.
- **Local fallback:** an in-process map, correct for one node and for tests.

A store outage fails open and logs `rate limit store unavailable`. That is deliberate — a limiter
outage must not lock everyone out of sign-in — but it means the limiter is not a hard guarantee.

Limits currently enforced: signup 5/hour/email, login 8/10 min/email, contact 3/hour/email,
join 20/hour/user, redemption 30/hour/user, sales 600/hour/user, voucher verification 600/hour/user,
reversals 60/hour/user, point adjustments 60/hour/user.

## Input handling and error messages

- Every action parses input through `lib/validate.ts` (`text`, `optionalText`, `positiveInt`,
  `toPaise`, `safeNext`, `email`, `password`). Lengths are bounded; money is parsed from decimal
  strings into integer paise.
- `safeNext` only accepts relative paths, so the `?next=` parameter cannot be used for an open
  redirect.
- Domain errors surface as human messages; unexpected errors are rethrown and rendered by the error
  boundary without stack traces or SQL. `unstable_rethrow` keeps `redirect()` from being mistaken for
  a failure.
- All SQL is parameterised. The two places that build `IN (...)` lists do so from a validated set of
  business ids, never from raw input.

## Secrets

`.env` and `data/` are gitignored; `.env.example` documents variable names only. The seed prints a
generated admin password once and stores only its hash. No secret is read at module scope except the
database URL and the rate-limit credentials.

## Open risks

1. **No email provider.** There is no password reset and no email verification, because sending mail
   without a configured provider would be a lie. Add Resend/Postmark and gate password reset on a
   verified address before launch.
2. **No hosted Supabase run.** Migrations and RLS were executed against a local PostgreSQL 18.4
   server, not a Supabase project (no credentials were available). Expect to re-run
   `scripts/migrate.mjs` and the RLS suite against the real project before launch.
3. **No MFA, no session listing UI.** Sessions expire and can be revoked, but users cannot see or end
   individual devices from the interface.
4. **CSP allows `'unsafe-inline'`** for scripts and styles, as explained above.
5. **Notifications are in-app only** — no email, SMS or push, so a customer who never opens the app
   misses them.
6. **No dependency audit in CI.** Run `npm audit` and enable Dependabot before launch.
7. **Rate limiting fails open** when the shared store is unreachable.
