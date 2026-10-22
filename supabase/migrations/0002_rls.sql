-- Repeato — row level security.
--
-- Two access paths exist:
--   1. The Next.js server (service role key, bypasses RLS) — every query it runs is
--      already tenant-scoped in lib/services.ts. RLS is not the only guard there.
--   2. Any browser client holding the publishable key — RLS is the ONLY guard.
-- Policies below are deny-by-default: no policy means no access.

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

-- Helpers. security definer so a policy can read membership without recursive RLS.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from users
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from business_members where business_id = b and user_id = auth.uid());
$$;

create or replace function public.owns(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_members
    where business_id = b and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.is_customer(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from business_customers where business_id = b and user_id = auth.uid());
$$;

create or replace function public.business_is_active(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = b and status = 'active');
$$;

-- users: read/update yourself; admins read everyone.
create policy users_read on users for select
  using (id = auth.uid() or is_admin());
create policy users_update on users for update
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- sessions are server-only: no policy at all.

-- businesses: public directory sees active rows; members and admins see their own.
create policy businesses_read on businesses for select
  using (status = 'active' or is_member(id) or is_admin());
create policy businesses_insert on businesses for insert
  with check (auth.uid() is not null);
create policy businesses_update on businesses for update
  using (owns(id) or is_admin())
  with check (owns(id) or is_admin());
create policy businesses_delete on businesses for delete
  using (owns(id) or is_admin());

create policy members_read on business_members for select
  using (is_member(business_id) or is_admin());
create policy members_write on business_members for all
  using (owns(business_id) or is_admin())
  with check (owns(business_id) or is_admin());

create policy business_customers_read on business_customers for select
  using (user_id = auth.uid() or is_member(business_id) or is_admin());
create policy business_customers_join on business_customers for insert
  with check (user_id = auth.uid() and business_is_active(business_id));

-- Catalogue tables: members write, members + shoppers of an active business read.
create policy categories_read on categories for select
  using (is_member(business_id) or is_admin() or business_is_active(business_id));
create policy categories_write on categories for all
  using (is_member(business_id) or is_admin())
  with check (is_member(business_id) or is_admin());

create policy products_read on products for select
  using (is_member(business_id) or is_admin() or business_is_active(business_id));
create policy products_write on products for all
  using (is_member(business_id) or is_admin())
  with check (is_member(business_id) or is_admin());

create policy rewards_read on rewards for select
  using (is_member(business_id) or is_admin() or business_is_active(business_id));
create policy rewards_write on rewards for all
  using (is_member(business_id) or is_admin())
  with check (is_member(business_id) or is_admin());

-- Money-bearing rows: readable by the owning customer, the business team, admins.
-- Never writable from a browser session — awarding, reversing and redeeming are
-- server-side transactions (see lib/services.ts). No insert/update policies exist,
-- which is the enforcement of that rule.
create policy purchases_read on purchases for select
  using (customer_id = auth.uid() or is_member(business_id) or is_admin());

create policy purchase_items_read on purchase_items for select
  using (exists (
    select 1 from purchases p
    where p.id = purchase_id
      and (p.customer_id = auth.uid() or is_member(p.business_id) or is_admin())
  ));

create policy ledger_read on ledger for select
  using (customer_id = auth.uid() or is_member(business_id) or is_admin());

create policy redemptions_read on redemptions for select
  using (customer_id = auth.uid() or is_member(business_id) or is_admin());

create policy notifications_read on notifications for select
  using (user_id = auth.uid());
create policy notifications_update on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- audit_log is admin-read, server-write.
create policy audit_admin_read on audit_log for select
  using (is_admin());
