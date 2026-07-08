-- Owner confirm/decline gate for paid bookings.
--
-- Previously a captured payment auto-confirmed and created the calendar event.
-- Now a paid booking waits at status='paid' until the owner confirms (creates
-- the calendar event → 'confirmed') or declines (→ 'declined', PayPal refunded).
--
-- 'declined' is not part of the bookings_no_overlap EXCLUDE predicate
-- ('pending','paid','confirmed'), so declining frees the slot automatically.

-- New terminal status for owner-rejected bookings. IF NOT EXISTS keeps this
-- migration idempotent; adding a value (without using it here) is transaction-safe.
alter type app.booking_status add value if not exists 'declined';

-- Refund bookkeeping for declined PayPal bookings.
alter table app.bookings add column if not exists refund_ref  text;
alter table app.bookings add column if not exists refunded_at timestamptz;
