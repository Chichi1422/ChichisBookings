-- Owner notification queue.
--
-- Confirm/decline/reschedule set pending_notification to the kind of decision;
-- the owner clears it once the customer has been messaged on WhatsApp. Non-null
-- means "the customer has not yet been told about this decision", which drives
-- the persistent "To notify" list in /admin (replacing the old one-shot banner
-- that each new action overwrote).

alter table app.bookings add column if not exists pending_notification text
  check (pending_notification in ('confirmed','declined','rescheduled'));
