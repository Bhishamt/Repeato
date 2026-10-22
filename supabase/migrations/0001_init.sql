-- Repeato — production (Supabase/Postgres) schema.
-- The running app in this repository uses the SQLite mirror in lib/schema.ts;
-- this file is the Postgres target for deployment. Column semantics are identical:
-- money is integer minor units (paise), points are integers, balances are derived
-- from the ledger, never stored.

create extension if not exists "pgcrypto";

create type user_role       as enum ('owner', 'staff', 'customer', 'admin');
create type account_status  as enum ('active', 'suspended');
create type business_status as enum ('pending', 'active', 'suspended');
create type member_role     as enum ('owner', 'staff');
create type purchase_status as enum ('verified', 'reversed');
create type ledger_kind     as enum ('earn', 'redeem', 'reverse', 'adjust', 'bonus');
create type redemption_status as enum ('issued', 'redeemed', 'cancelled');

-- App profile row, 1:1 with Supabase auth.users.
create table users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  name          text not null,
  phone         text,
  password_hash text,
  role          user_role not null default 'customer',
  status        account_status not null default 'active',
  created_at    timestamptz not null default now()
);

create table sessions (
  token_hash text primary key,
  user_id    uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user on sessions (user_id);

create table businesses (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text not null unique,
  category           text not null,
  description        text,
  brand_color        text not null default '#17553f',
  address            text,
  city               text,
  phone              text,
  status             business_status not null default 'pending',
  points_per_100     integer not null default 10,
  min_purchase_paise integer not null default 10000,
  signup_bonus       integer not null default 20,
  min_redeem_points  integer not null default 100,
  max_points_per_txn integer not null default 1000,
  created_at         timestamptz not null default now()
);
create index businesses_status on businesses (status);

create table business_members (
  user_id     uuid not null references users (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  role        member_role not null default 'staff',
  created_at  timestamptz not null default now(),
  primary key (user_id, business_id)
);
create index members_business on business_members (business_id);

create table business_customers (
  business_id uuid not null references businesses (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index bc_user on business_customers (user_id);

create table categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  unique (business_id, name)
);

create table products (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses (id) on delete cascade,
  category_id    uuid references categories (id) on delete set null,
  name           text not null,
  description    text,
  price_paise    integer not null,
  points_override integer,
  available      boolean not null default true,
  archived       boolean not null default false
);
create index products_business on products (business_id, archived);

create table rewards (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses (id) on delete cascade,
  name             text not null,
  description      text,
  points_cost      integer not null,
  active           boolean not null default true,
  stock            integer,
  per_customer_limit integer,
  valid_until      timestamptz
);
create index rewards_business on rewards (business_id, active);

create table purchases (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses (id) on delete cascade,
  customer_id     uuid not null references users (id),
  staff_id        uuid not null references users (id),
  amount_paise    integer not null,
  points_awarded  integer not null default 0,
  status          purchase_status not null default 'verified',
  reference       text,
  note            text,
  idempotency_key text not null unique,
  created_at      timestamptz not null default now(),
  reversed_at     timestamptz
);
create index purchases_business on purchases (business_id, created_at desc);
create index purchases_customer on purchases (customer_id, created_at desc);

create table purchase_items (
  id               uuid primary key default gen_random_uuid(),
  purchase_id      uuid not null references purchases (id) on delete cascade,
  product_id       uuid references products (id) on delete set null,
  name             text not null,
  unit_price_paise integer not null,
  quantity         integer not null default 1,
  points           integer not null default 0
);
create index purchase_items_purchase on purchase_items (purchase_id);

create table redemptions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses (id) on delete cascade,
  customer_id  uuid not null references users (id),
  reward_id    uuid not null references rewards (id),
  points_spent integer not null,
  token        text not null unique,
  status       redemption_status not null default 'issued',
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  redeemed_at  timestamptz,
  redeemed_by  uuid references users (id)
);
create index redemptions_business on redemptions (business_id, status, issued_at desc);
create index redemptions_customer on redemptions (customer_id, issued_at desc);

create table ledger (
  id            bigserial primary key,
  business_id   uuid not null references businesses (id) on delete cascade,
  customer_id   uuid not null references users (id),
  purchase_id   uuid references purchases (id) on delete set null,
  redemption_id uuid references redemptions (id) on delete set null,
  delta         integer not null check (delta <> 0),
  kind          ledger_kind not null,
  note          text,
  created_at    timestamptz not null default now()
);
create index ledger_account on ledger (business_id, customer_id, created_at desc);

create table notifications (
  id          bigserial primary key,
  user_id     uuid not null references users (id) on delete cascade,
  business_id uuid references businesses (id) on delete set null,
  title       text not null,
  body        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user on notifications (user_id, created_at desc);

create table audit_log (
  id         bigserial primary key,
  actor_id   uuid references users (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index audit_created on audit_log (created_at desc);

-- Derived balance, the single source of truth for a customer's points.
create view account_balances as
  select business_id, customer_id, sum(delta)::integer as balance
  from ledger
  group by business_id, customer_id;
