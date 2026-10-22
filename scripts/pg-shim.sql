-- Local/test-only shim that reproduces the Supabase roles and grants the RLS
-- policies in 0002 expect. NEVER run this against Supabase: the platform already
-- provides `anon`, `authenticated`, `service_role` and the grants below.
--
--   psql -f scripts/pg-shim.sql        (or: node scripts/migrate.mjs --local)
--
-- After this file, a test can impersonate a user exactly like a browser would:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<users.id>"}';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- Mirror of the column/table restrictions in 0002_rls.sql. Supabase applies its
-- default grants when a table is created, so the migration revokes what it needs;
-- this shim runs after the migrations and must reproduce both halves.
revoke update on users from authenticated, anon;
grant update (name, phone) on users to authenticated;
revoke insert, update, delete on sessions       from authenticated, anon;
revoke insert, update, delete on audit_log      from authenticated, anon;
revoke insert, update, delete on ledger         from authenticated, anon;
revoke insert, update, delete on purchases      from authenticated, anon;
revoke insert, update, delete on purchase_items from authenticated, anon;
revoke insert, update, delete on redemptions    from authenticated, anon;
