-- 0003: least-privilege application role.
--
-- The application connects as `repeato_app`. It owns no objects, cannot alter the
-- schema, and cannot delete from money or audit tables. RLS stays enabled on every
-- business table; the permissive policy below exists only for this role, so the
-- `anon` / `authenticated` policies from 0002 keep protecting the API surface.
--
-- The password is never stored here. Set it once at deploy time:
--   alter role repeato_app password '<generated>';
-- and put the resulting URL in DATABASE_URL.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'repeato_app') then
    create role repeato_app login;
  end if;
end
$$;

grant usage on schema public to repeato_app;

-- Read and write, no delete.
grant select, insert, update on
  users, businesses, business_customers, products, rewards,
  purchases, purchase_items, ledger, redemptions, notifications, audit_log
  to repeato_app;

-- The product genuinely removes rows here: team members, menu categories, sessions.
grant select, insert, update, delete on business_members, categories, sessions to repeato_app;

grant usage, select on all sequences in schema public to repeato_app;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'sessions', 'businesses', 'business_members', 'business_customers',
    'categories', 'products', 'rewards', 'purchases', 'purchase_items', 'ledger',
    'redemptions', 'notifications', 'audit_log'
  ]
  loop
    execute format('drop policy if exists app_role_access on %I', t);
    execute format(
      'create policy app_role_access on %I for all to repeato_app using (true) with check (true)',
      t
    );
  end loop;
end
$$;
