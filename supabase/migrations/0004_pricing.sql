-- Chi Chi's Beauty Spa — admin-managed pricing + multi-currency support.
--
-- Moves the service catalog out of hardcoded TS (app/lib/services.server.ts and
-- the duplicated array in app/components/spa.tsx) into the DB so the owner can
-- manage it from /admin. Adds an FX-rate cache and a pricing-config singleton so
-- ZAR base prices can be charged in USD/EUR with an owner-set markup.
--
-- Base currency is always ZAR (source of truth). PayPal cannot process ZAR, so
-- USD/EUR charge amounts are derived at checkout from these ZAR prices.

-- ---------------------------------------------------------------------------
-- Service catalog: a "group" (the card, e.g. Swedish Massage) has one or more
-- "options" (durations with prices). This mirrors the booking UI exactly.
-- ---------------------------------------------------------------------------
create table if not exists app.service_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text not null default '',
  icon        text not null default '✿',
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists app.service_options (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references app.service_groups(id) on delete cascade,
  duration_label   text not null,
  duration_minutes int  not null check (duration_minutes between 15 and 240),
  price_zar        numeric(10,2) not null check (price_zar >= 0),
  sort_order       int  not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (group_id, duration_label)
);

create index if not exists service_options_group_idx
  on app.service_options (group_id);

-- ---------------------------------------------------------------------------
-- Pricing config: singleton row. FX markup and home-call fee become
-- owner-editable instead of the hardcoded HOME_CALL_FEE_ZAR constant.
-- ---------------------------------------------------------------------------
create table if not exists app.pricing_config (
  id                smallint primary key default 1,
  fx_markup_pct     numeric(5,2)  not null default 0   check (fx_markup_pct >= 0 and fx_markup_pct <= 100),
  home_call_fee_zar numeric(10,2) not null default 250 check (home_call_fee_zar >= 0),
  updated_at        timestamptz not null default now(),
  constraint pricing_config_singleton check (id = 1)
);

insert into app.pricing_config (id) values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- FX rate cache. Base is always ZAR; `rate` is how much of `quote_currency`
-- one ZAR buys (usd_amount = zar * rate). Refreshed from a live feed when
-- `fetched_at` is older than the app's TTL; seeded stale so the first real
-- checkout refreshes it, while still giving a fallback if the feed is down.
-- ---------------------------------------------------------------------------
create table if not exists app.fx_rates (
  quote_currency text primary key check (quote_currency in ('USD','EUR')),
  rate           numeric(18,8) not null check (rate > 0),
  fetched_at     timestamptz not null default now()
);

insert into app.fx_rates (quote_currency, rate, fetched_at) values
  ('USD', 0.053, 'epoch'),
  ('EUR', 0.049, 'epoch')
on conflict (quote_currency) do nothing;

-- ---------------------------------------------------------------------------
-- Record what the customer was actually charged (currency + amount), since it
-- may differ from amount_zar once converted.
-- ---------------------------------------------------------------------------
alter table app.bookings add column if not exists paid_currency text
  check (paid_currency in ('ZAR','USD','EUR'));
alter table app.bookings add column if not exists paid_amount numeric(12,2);

-- ---------------------------------------------------------------------------
-- Seed the catalog from the current live menu (app/components/spa.tsx). Names
-- are the customer-facing ones — this also resolves the prior mismatch where
-- the server catalog used different pedicure names than the UI.
-- ---------------------------------------------------------------------------
insert into app.service_groups (name, description, icon, sort_order) values
  ('Swedish Massage / Aroma Therapy', 'Gentle, flowing strokes to ease tension and promote deep relaxation', '✿', 1),
  ('Deep Tissue / Sports Massage',    'Intensive pressure targeting muscle knots and chronic tension',        '❋', 2),
  ('Hot Stone Therapy',               'Heated volcanic stones melt away stress and restore balance',          '◈', 3),
  ('Reflexology',                     'Pressure point therapy on feet to restore energy flow',                '✧', 4),
  ('Neck Shoulder and Back',          'Targting shoulders and back to relieve stress and tension',            '❋', 5),
  ('Pedicure without Gel Polish',     'Classic pedicure treatment for beautiful, pampered feet',              '❀', 6),
  ('Pedicure with Gel Polish',        'Luxury pedicure with long-lasting gel polish finish',                  '❀', 7)
on conflict (name) do nothing;

insert into app.service_options (group_id, duration_label, duration_minutes, price_zar, sort_order)
select g.id, v.duration_label, v.duration_minutes, v.price_zar, v.sort_order
from (values
  ('Swedish Massage / Aroma Therapy', '30 min', 30, 400, 1),
  ('Swedish Massage / Aroma Therapy', '60 min', 60, 600, 2),
  ('Swedish Massage / Aroma Therapy', '90 min', 90, 800, 3),
  ('Deep Tissue / Sports Massage',    '30 min', 30, 500, 1),
  ('Deep Tissue / Sports Massage',    '60 min', 60, 700, 2),
  ('Deep Tissue / Sports Massage',    '90 min', 90, 900, 3),
  ('Hot Stone Therapy',               '30 min', 30, 400, 1),
  ('Hot Stone Therapy',               '60 min', 60, 750, 2),
  ('Hot Stone Therapy',               '90 min', 90, 950, 3),
  ('Reflexology',                     '30 min', 30, 350, 1),
  ('Neck Shoulder and Back',          '30 min', 30, 300, 1),
  ('Neck Shoulder and Back',          '60 min', 60, 450, 2),
  ('Pedicure without Gel Polish',     '30 min', 30, 300, 1),
  ('Pedicure with Gel Polish',        '30 min', 30, 400, 1)
) as v(group_name, duration_label, duration_minutes, price_zar, sort_order)
join app.service_groups g on g.name = v.group_name
on conflict (group_id, duration_label) do nothing;

-- ---------------------------------------------------------------------------
-- RLS + grants, mirroring 0001/0003: enable RLS with no policies, grant only
-- service_role. (0003 already set default privileges for future tables, but we
-- repeat the explicit grants here so this migration is self-contained.)
-- ---------------------------------------------------------------------------
alter table app.service_groups  enable row level security;
alter table app.service_options enable row level security;
alter table app.pricing_config  enable row level security;
alter table app.fx_rates        enable row level security;

grant select, insert, update, delete
  on app.service_groups, app.service_options, app.pricing_config, app.fx_rates
  to service_role;

revoke all on app.service_groups, app.service_options, app.pricing_config, app.fx_rates
  from anon, authenticated;
