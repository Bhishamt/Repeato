-- Repeato — row level security (PostgreSQL / Supabase).
--
-- Two access paths exist:
--   1. The Next.js server (service role / owner connection) — every query it runs
--      is already tenant-scoped in lib/services.ts and lib/db. RLS is a second
--      wall, not the only one.
--   2. Any client holding the publishable key — RLS is the ONLY guard there.
--
-- Policies are deny-by-default: no policy means no access. Every table has RLS
-- enabled, including the ones with no policies at all (sessions, audit_log
-- writes), so an anon key can read nothing it was not explicitly granted.

-- Supabase ships the anon/authenticated roles; a plain PostgreSQL server does
-- not. Create them when missing so this migration can be verified anywhere.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin noinherit';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon nologin noinherit';
  end if;
end
$$;

grant usage on schema public to authenticated, anon;

alter table users              enable row level security;
alter table sessions           enable row level security;
alter table businesses         enable row level security;
alter table business_members   enable row level security;
alter table business_customers enable row level security;
alter table categories         enable row level security;
alter table products           enable row level security;
alter table rewards            enable row level security;
alter table purchases          enable row level security;
alter table purchase_items     enable row level security;
alter table redemptions        enable row level security;
alter table ledger             enable row level security;
alter table notifications      enable row level security;
alter table audit_log          enable row level security;

-- Identity of the caller as seen by RLS. The app authenticates with its own
-- session cookie and connects as the table owner, which bypasses RLS; this
-- function exists for browser clients that carry a Supabase JWT.
-- Swap the body for `select id from users where auth_user_id = auth.uid()`
-- once Supabase Auth is adopted (see 0001 header).
create or replace function public.current_user_id() returns bigint
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::bigint;
$$;

-- Helpers are security definer so a policy can read membership tables without
-- tripping their own RLS (which would recurse). The owner must be a role with
-- BYPASSRLS — `postgres` on Supabase, the superuser created by initdb locally.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from users
    where id = public.current_user_id() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_member(b bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_members
    where business_id = b and user_id = public.current_user_id()
  );
$$;

create or replace function public.owns(b bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_members
    where business_id = b and user_id = public.current_user_id() and role = 'owner'
  );
$$;

create or replace function public.is_customer(b bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_customers
    where business_id = b and user_id = public.current_user_id()
  );
$$;

create or replace function public.business_is_active(b bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = b and status = 'active');
$$;

-- Used only by the first-owner bootstrap policy below. Kept as a function so the
-- policy does not reference business_members from inside a business_members
-- policy, which PostgreSQL rejects as infinite recursion.
create or replace function public.has_no_members(b bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from business_members where business_id = b);
$$;

-- users: read/update yourself; admins read and update everyone.
-- No insert policy: accounts are created by the server (scrypt password, role
-- chosen server-side). A browser can never mint itself an admin.
create policy users_read on users for select
  using (id = public.current_user_id() or public.is_admin());
create policy users_update on users for update
  using (id = public.current_user_id() or public.is_admin())
  with check (id = public.current_user_id() or public.is_admin());

-- sessions: server-only. No policy at all on purpose.

-- businesses: the public directory sees active rows; members and admins see their own.
create policy businesses_read on businesses for select
  using (status = 'active' or public.is_member(id) or public.is_admin());
create policy businesses_insert on businesses for insert
  with check (public.current_user_id() is not null);
create policy businesses_update on businesses for update
  using (public.owns(id) or public.is_admin())
  with check (public.owns(id) or public.is_admin());
create policy businesses_delete on businesses for delete
  using (public.owns(id) or public.is_admin());

-- members: staff see the team, owners manage it, and a brand-new business may
-- claim exactly one owner row (the create-business bootstrap).
create policy members_read on business_members for select
  using (public.is_member(business_id) or public.is_admin());
create policy members_write on business_members for all
  using (public.owns(business_id) or public.is_admin())
  with check (public.owns(business_id) or public.is_admin());
create policy members_bootstrap on business_members for insert
  with check (
    user_id = public.current_user_id()
    and role = 'owner'
    and public.has_no_members(business_id)
  );

create policy business_customers_read on business_customers for select
  using (user_id = public.current_user_id() or public.is_member(business_id) or public.is_admin());
create policy business_customers_join on business_customers for insert
  with check (user_id = public.current_user_id() and public.business_is_active(business_id));

-- Catalogue: members write; members, admins and shoppers of an active business read.
create policy categories_read on categories for select
  using (public.is_member(business_id) or public.is_admin() or public.business_is_active(business_id));
create policy categories_write on categories for all
  using (public.is_member(business_id) or public.is_admin())
  with check (public.is_member(business_id) or public.is_admin());

create policy products_read on products for select
  using (public.is_member(business_id) or public.is_admin() or public.business_is_active(business_id));
create policy products_write on products for all
  using (public.is_member(business_id) or public.is_admin())
  with check (public.is_member(business_id) or public.is_admin());

create policy rewards_read on rewards for select
  using (public.is_member(business_id) or public.is_admin() or public.business_is_active(business_id));
create policy rewards_write on rewards for all
  using (public.is_member(business_id) or public.is_admin())
  with check (public.is_member(business_id) or public.is_admin());

-- Money-bearing rows: readable by the owning customer, the business team and
-- admins. Deliberately no insert/update/delete policy — awarding, reversing and
-- redeeming are server-side transactions with their own idempotency guards.
create policy purchases_read on purchases for select
  using (customer_id = public.current_user_id() or public.is_member(business_id) or public.is_admin());

create policy purchase_items_read on purchase_items for select
  using (exists (
    select 1 from purchases p
    where p.id = purchase_id
      and (p.customer_id = public.current_user_id() or public.is_member(p.business_id) or public.is_admin())
  ));

create policy ledger_read on ledger for select
  using (customer_id = public.current_user_id() or public.is_member(business_id) or public.is_admin());

create policy redemptions_read on redemptions for select
  using (customer_id = public.current_user_id() or public.is_member(business_id) or public.is_admin());

create policy notifications_read on notifications for select
  using (user_id = public.current_user_id());
create policy notifications_update on notifications for update
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- audit_log is admin-read, server-write.
create policy audit_admin_read on audit_log for select
  using (public.is_admin());

-- Column-level privileges back the policies above. RLS decides which ROWS a
-- browser may touch; grants decide which COLUMNS. Without the revoke below a
-- customer could update their own row's `role` column to 'admin' — the policy
-- allows self-updates, so only the grant stops it.
revoke update on users from authenticated, anon;
grant update (name, phone) on users to authenticated;

-- Server-only tables: no browser write path at all, even if a policy is ever
-- added by mistake.
revoke insert, update, delete on sessions     from authenticated, anon;
revoke insert, update, delete on audit_log    from authenticated, anon;
revoke insert, update, delete on ledger       from authenticated, anon;
revoke insert, update, delete on purchases    from authenticated, anon;
revoke insert, update, delete on purchase_items from authenticated, anon;
revoke insert, update, delete on redemptions  from authenticated, anon;
