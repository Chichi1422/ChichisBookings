-- Chi Chi's Beauty Spa — initial schema
-- Tables live in a private `app` schema. RLS is enabled with NO policies;
-- the server uses the service_role key only. The client never touches Supabase.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create schema if not exists app;

-- Singleton row holding the spa's Google OAuth tokens.
create table if not exists app.oauth_tokens (
  id            smallint primary key default 1,
  access_token  text not null,
  refresh_token text not null,
  scope         text,
  token_type    text,
  expiry_date   bigint,
  updated_at    timestamptz not null default now(),
  constraint oauth_tokens_singleton check (id = 1)
);

do $$ begin
  create type app.booking_status as enum
    ('pending','paid','confirmed','cancelled','expired');
exception when duplicate_object then null; end $$;

create table if not exists app.bookings (
  id                   uuid primary key default gen_random_uuid(),
  service              text not null,
  duration             text not null,
  duration_minutes     int  not null check (duration_minutes between 15 and 240),
  customer_name        text not null,
  customer_phone       text not null,
  booking_date         date not null,
  booking_time         time not null,
  start_at             timestamptz not null,
  end_at               timestamptz not null,
  is_home_call         boolean not null default false,
  payment_method       text not null check (payment_method in ('paypal','valr','cash')),
  payment_provider_ref text,
  amount_zar           numeric(10,2),
  status               app.booking_status not null default 'pending',
  google_event_id      text,
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null,
  -- Atomic double-booking prevention. Only "live" rows participate;
  -- expired pending rows are excluded so their slots free up automatically.
  constraint bookings_no_overlap exclude using gist (
    tstzrange(start_at, end_at, '[)') with &&
  ) where (
    status in ('pending','paid','confirmed')
    and (status <> 'pending' or expires_at > now())
  )
);

create index if not exists bookings_date_idx
  on app.bookings (booking_date);
create index if not exists bookings_status_expires_idx
  on app.bookings (status, expires_at);

alter table app.oauth_tokens enable row level security;
alter table app.bookings     enable row level security;
-- No policies. service_role bypasses RLS; anon/authenticated have no access.
