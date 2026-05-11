-- Hygiene job: every 5 minutes, mark stale pending bookings as expired.
-- The exclusion constraint already frees the slot lazily, but this keeps
-- the table observable in the admin UI.

create extension if not exists pg_cron;

select cron.schedule(
  'expire-stale-bookings',
  '*/5 * * * *',
  $$ update app.bookings
       set status = 'expired'
     where status = 'pending'
       and expires_at < now() $$
);
