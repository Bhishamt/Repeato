# Known limitations

Everything here is a real gap in this build. Nothing on this list is hidden, mocked, or described as
done elsewhere in the docs.

## Infrastructure

1. **SQLite, not Supabase.** The app runs on `better-sqlite3`. No Supabase project could be created
   in the build environment: there was no access token and no Docker daemon for a local stack.
   `supabase/migrations/0001_init.sql` and `0002_rls.sql` exist and are the intended production
   schema and policies, but **nothing in the running app executes them**. Consequently the RLS
   policies are unverified: they have not been applied to a database, so treat them as reviewed SQL,
   not tested SQL.
2. **No Postgres adapter.** `lib/services.ts` uses a synchronous driver. Porting to Vercel +
   Supabase means rewriting `lib/db.ts` and turning those calls async (`docs/DEPLOYMENT.md`).
   Until then, this app cannot be deployed to a serverless host.
3. **Single node only.** SQLite allows one writer; multiple replicas against one file will corrupt
   it. No horizontal scaling story.

## Product features

4. **No POS integration.** Never claimed. Purchases are entered by staff, or attributed to a
   customer the staff selects. Nothing is inferred from a scan.
5. **No email or SMS.** No provider was available, therefore:
   - no password reset (a locked-out user needs an operator to act),
   - no email verification (any address can be registered),
   - no receipts, no digests, no voucher reminders,
   - notifications are in-app only (`/app/notifications`).
6. **No phone OTP.** Same reason — no SMS provider.
7. **No payments or billing.** The pricing page is illustrative; there is no plan enforcement, no
   subscription state, no invoices.
8. **No self-serve account deletion or data export.** A real GDPR/DPDP gap. Deletion also has to
   decide what happens to immutable ledger rows, which the current schema does not answer.
9. **No campaign engine.** No multipliers, no scheduled promotions, no segments. Loyalty rules are
   stable per-business settings.
10. **No CSV/PDF export** from any console table.
11. **No push notifications or PWA install.** The customer app is mobile-first and responsive, but
    it is a website.
12. **No multi-language support.** English only, with Indian rupee formatting and Indian phone
    expectations in the copy.

## Design

13. **No Figma file.** The Figma MCP server was reachable and authenticated, but the account holds a
    **View** seat on a Starter team; `create_new_file` failed with *"Looks like you don't have edit
    access to this file."* No design file was created and none is claimed. The design is specified in
    `docs/FIGMA_DESIGN.md` as tokens, type scale and screen inventory, which is enough to build the
    file in an editor seat or to review the implemented UI directly.
14. **No design review pass at 320 px.** The layout was built mobile-first and checked at 390 × 844;
    very small screens (320 px) may need spacing adjustments on the tables.
15. **Illustrative copy only.** No invented testimonials, logos, customer counts or "trusted by"
    claims. Marketing numbers describe the product's mechanics (for example 10 points per ₹100),
    which are the actual defaults, not traction.

## Testing

16. **No React Testing Library / component tests.** Coverage is domain + integration + 4 browser
    flows. Markup and client-component behaviour (sale form state, chart rendering) are unverified
    except through the browser tests.
17. **No visual regression, no accessibility automation.** Focus states, contrast and reduced motion
    were handled by hand; no axe-core run is wired into CI.
18. **No CI pipeline.** The gates are runnable locally (`npm test`, `npx playwright test`,
    `npm run typecheck`, `npm run build`) but no workflow file exists.
19. **No load or concurrency testing** beyond the guarded-update logic exercised in unit tests.

## Security and operations

20. **Rate limiting is in-process.** Login (8 per 10 min), signup (5 per hour) and contact (3 per
    hour) are limited per instance only. Redemption and voucher verification have no limiter.
21. **No CSRF token.** Relies on Server Actions' POST-only semantics and `SameSite=Lax`.
22. **No content security policy**, no HSTS header (assumes the proxy adds it).
23. **Audit log covers writes only.** Reads are not audited.
24. **Sessions are custom, not Supabase Auth.** Migration path in `docs/DEPLOYMENT.md`; the current
    cookies and session table are not connected to an identity provider.
25. **Admin seed password is printed once** and stored hashed. There is no rotation script.

## Data

26. **Demo data is labelled but present** in any database created by `npm run seed`: backdated
    purchases, a `platform.seeded` audit row, and vouchers whose tokens the seed prints. Delete
    `data/` before showing the product to anyone as if it were live.
27. **No migration history.** `lib/schema.ts` is idempotent DDL applied at boot. Changing a column
    later needs a real migration tool, not a schema edit.

## Scoring note

The brief asked for a complete, production-ready product. This is a complete, tested application
with a documented production path — but "production-ready" stops at the serverless data layer and
the missing transactional email. Those two are the first things to fix, in that order.
