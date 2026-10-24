# Known limitations

Everything here is a deliberate, documented gap — not an accident. Each item names what it would take
to close it.

## Data layer

1. **No hosted Supabase execution.** The migrations and RLS policies run cleanly on a local
   PostgreSQL 18.4 server (`scripts/pg.mjs`) and the whole app runs on that server in the Playwright
   suite, but no Supabase project was reachable this session. Re-run `node scripts/migrate.mjs` and
   the RLS suite against the real project before launch.
2. **Two schema sources.** `supabase/migrations/*.sql` is authoritative for Postgres;
   `lib/schema.ts` bootstraps SQLite for local development. A schema change must be mirrored in both.
   A generated-migration workflow would remove the duplication.
3. **SQLite is single-node.** `better-sqlite3` needs a persistent disk and one writer. Fine for a VPS
   or a demo, not for Vercel Functions.
4. **The Postgres driver rewrites `?` placeholders to `$n`.** That keeps one SQL dialect across both
   engines but means `?` inside a string literal or a `::json` cast needs care when adding queries.
5. **Boolean-ish columns are `integer` 0/1** (`products.available`, `products.archived`,
   `rewards.active`) so the same predicates work on both engines. Idiomatic Postgres would use
   `boolean`; doing so would have required rewriting every query.

## Product

6. **No email or SMS.** No password reset, no email verification, no receipts, no expiry reminders.
   In-app notifications only. This is the largest user-facing gap.
7. **No POS integration.** Purchases are recorded by staff in the console, or verified from a
   customer-submitted bill. Nothing here claims otherwise.
8. **Pricing page is illustrative.** No billing, no plans, no Stripe.
9. **No Figma file.** `docs/FIGMA_DESIGN.md` describes the design system in tokens and component
   specs so it can be rebuilt in Figma; no design file was produced.
10. **Demo data is labelled but present.** `npm run seed` writes six demo accounts, two businesses,
    sample purchases and vouchers. Delete `data/` (SQLite) or re-create the database (Postgres) before
    showing the product as if it were live.
11. **Single business per console session.** Owners with several businesses switch with a cookie; the
    UI shows one at a time.
12. **Exports.** `lib/csv.ts` implements RFC 4180 CSV generation and formula injection mitigation for transactions and customers; scheduled automated reporting remains a future enhancement.
13. **No mobile app.** The customer experience is a mobile-first web app at `/app`.

## Testing and operations

14. **No component tests.** Vitest covers points, services and RLS; React Testing Library is not
    installed. UI behaviour is covered only end-to-end.
15. **No CI pipeline.** `typecheck`, `test`, `playwright test` and `build` are the gates; wiring them
    into GitHub Actions is a one-file job that was not done.
16. **No load testing.** The concurrency assertions prove correctness, not throughput.
17. **No observability.** No structured logs, metrics or error tracking beyond console output and
    Next's error boundary.
18. **No backups configured.** `docs/DEPLOYMENT.md` describes what to enable; nothing is scheduled.
19. **Mobile layout is checked by hand** at 390px, not asserted in CI.

## Security

20. **CSP allows `'unsafe-inline'`** for scripts and styles (Next injects inline bootstrap scripts,
    Tailwind emits inline styles). A nonce-based policy needs middleware.
21. **Rate limiting fails open** if the shared Redis store is unreachable.
22. **No MFA and no device/session management UI.** Sessions expire after 30 days and can be revoked
    server-side, but users cannot inspect them.
23. **No dependency scanning** in CI.

## What would I fix first

Email (reset + verification), then a hosted Supabase migration run with the RLS suite, then CI with
all four gates. Those three turn a tested application into an operable one.
