// Booking reservation lifecycle: pending → paid → confirmed | expired | cancelled.
//
// The Postgres EXCLUDE constraint on app.bookings is the single source of truth
// for slot availability. If two reservations race, exactly one wins.

import { supabaseAdmin } from './supabase.server';
import { lookupService, totalPrice, getPricingConfig } from './services.server';

const TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Africa/Johannesburg';
const PAID_RESERVATION_TTL_MIN = 10;

export type PaymentMethod = 'paypal' | 'valr' | 'cash';

export interface ReserveSlotInput {
  service: string;
  duration: string;
  customerName: string;
  customerPhone: string;
  bookingDate: string; // YYYY-MM-DD
  bookingTime: string; // HH:MM (24h)
  isHomeCall: boolean;
  paymentMethod: PaymentMethod;
}

export interface BookingRow {
  id: string;
  service: string;
  duration: string;
  duration_minutes: number;
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
  start_at: string;
  end_at: string;
  is_home_call: boolean;
  payment_method: PaymentMethod;
  payment_provider_ref: string | null;
  amount_zar: number | null;
  status: 'pending' | 'paid' | 'confirmed' | 'cancelled' | 'expired' | 'declined';
  google_event_id: string | null;
  created_at: string;
  expires_at: string;
  paid_currency: string | null;
  paid_amount: number | null;
  refund_ref: string | null;
  refunded_at: string | null;
}

export type ReserveResult =
  | { ok: true; reservation: BookingRow; amountZar: number }
  | { ok: false; error: 'slot_taken' | 'invalid_service' | 'invalid_time' | 'db_error'; detail?: string };

export type ConfirmResult =
  | { ok: true; booking: BookingRow }
  | { ok: false; error: 'reservation_expired' | 'reservation_missing' | 'db_error'; detail?: string };

/**
 * Builds the timezone-aware start_at/end_at for a date+time pair. We assemble
 * the timestamp using the configured business timezone so DST and local-vs-UTC
 * behave predictably. Returns ISO strings.
 */
function buildStartEnd(dateStr: string, timeStr: string, durationMinutes: number) {
  // Construct a string like "2026-05-15T10:00:00+02:00" for SAST.
  // Africa/Johannesburg has no DST so SAST is always +02:00; if the timezone
  // ever changes, this needs to consult an actual tz library.
  const offset = '+02:00';
  const startIso = `${dateStr}T${timeStr}:00${offset}`;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`);
  }
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

function expiresAtFor(method: PaymentMethod, start_at: string): string {
  if (method === 'cash') {
    // Cash holds the slot until 24h before the appointment, giving the owner
    // a window to confirm.
    const t = new Date(start_at).getTime() - 24 * 60 * 60_000;
    // Don't expire in the past — clamp to "now + 10 min" minimum.
    return new Date(Math.max(t, Date.now() + 10 * 60_000)).toISOString();
  }
  return new Date(Date.now() + PAID_RESERVATION_TTL_MIN * 60_000).toISOString();
}

/**
 * Atomically reserve a slot. Returns 'slot_taken' if the time overlaps an
 * existing live booking (the EXCLUDE constraint enforces this).
 */
export async function reserveSlot(input: ReserveSlotInput): Promise<ReserveResult> {
  const svc = await lookupService(input.service, input.duration);
  if (!svc) {
    return { ok: false, error: 'invalid_service', detail: `${input.service} / ${input.duration}` };
  }

  let timing: { start_at: string; end_at: string };
  try {
    timing = buildStartEnd(input.bookingDate, input.bookingTime, svc.durationMinutes);
  } catch (e) {
    return { ok: false, error: 'invalid_time', detail: (e as Error).message };
  }

  // Refuse to reserve a slot in the past.
  if (new Date(timing.start_at).getTime() < Date.now()) {
    return { ok: false, error: 'invalid_time', detail: 'slot in the past' };
  }

  const { homeCallFeeZar } = await getPricingConfig();
  const amount = totalPrice(svc.priceZar, input.isHomeCall, homeCallFeeZar);
  const expires_at = expiresAtFor(input.paymentMethod, timing.start_at);

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .insert({
      service: svc.service,
      duration: svc.duration,
      duration_minutes: svc.durationMinutes,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      booking_date: input.bookingDate,
      booking_time: input.bookingTime,
      start_at: timing.start_at,
      end_at: timing.end_at,
      is_home_call: input.isHomeCall,
      payment_method: input.paymentMethod,
      amount_zar: amount,
      status: 'pending',
      expires_at,
    })
    .select('*')
    .single();

  if (error) {
    // 23P01 = exclusion_violation (slot overlap). Postgres surfaces this
    // through PostgREST as a 409 with code "23P01".
    if (error.code === '23P01' || /exclu/i.test(error.message)) {
      return { ok: false, error: 'slot_taken' };
    }
    console.error('[bookings] reserve insert failed:', error);
    return { ok: false, error: 'db_error', detail: error.message };
  }

  return { ok: true, reservation: data as BookingRow, amountZar: amount };
}

/**
 * Marks a reservation as paid. Atomically asserts the row is still pending
 * and not yet expired — if either is false, returns 'reservation_expired'.
 */
export async function markPaid(
  reservationId: string,
  paymentProviderRef: string,
  paid?: { currency: string; amount: number },
): Promise<ConfirmResult> {
  const update: Record<string, unknown> = {
    status: 'paid',
    payment_provider_ref: paymentProviderRef,
  };
  if (paid) {
    update.paid_currency = paid.currency;
    update.paid_amount = paid.amount;
  }

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update(update)
    .eq('id', reservationId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[bookings] markPaid failed:', error);
    return { ok: false, error: 'db_error', detail: error.message };
  }
  if (!data) {
    // Either missing, or already paid/expired/cancelled.
    return { ok: false, error: 'reservation_expired' };
  }
  return { ok: true, booking: data as BookingRow };
}

/**
 * Records the Google Calendar event id and flips the row to 'confirmed'.
 */
export async function markConfirmed(
  reservationId: string,
  googleEventId: string,
): Promise<ConfirmResult> {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'confirmed', google_event_id: googleEventId })
    .eq('id', reservationId)
    .in('status', ['paid', 'pending'])
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[bookings] markConfirmed failed:', error);
    return { ok: false, error: 'db_error', detail: error.message };
  }
  if (!data) {
    return { ok: false, error: 'reservation_missing' };
  }
  return { ok: true, booking: data as BookingRow };
}

/**
 * Owner declines a paid booking. Atomic 'paid' → 'declined' so a double-click
 * can't decline (or trigger a refund) twice — only the first caller gets the
 * row back. Frees the slot (declined is outside the overlap constraint).
 */
export async function markDeclined(reservationId: string): Promise<ConfirmResult> {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'declined' })
    .eq('id', reservationId)
    .eq('status', 'paid')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[bookings] markDeclined failed:', error);
    return { ok: false, error: 'db_error', detail: error.message };
  }
  if (!data) {
    // Not paid, missing, or already handled by a concurrent decline.
    return { ok: false, error: 'reservation_missing' };
  }
  return { ok: true, booking: data as BookingRow };
}

/**
 * Owner moves a paid (pending-confirmation) booking to a new date/time. The
 * EXCLUDE constraint rejects a move that overlaps another live booking. The
 * booking stays at 'paid' — the owner still confirms afterwards. No calendar
 * event exists yet at this stage, so there's nothing to move on Google.
 */
export async function rescheduleBooking(
  reservationId: string,
  bookingDate: string,
  bookingTime: string,
): Promise<
  | { ok: true; booking: BookingRow }
  | { ok: false; error: 'slot_taken' | 'invalid_time' | 'not_paid' | 'db_error'; detail?: string }
> {
  const existing = await getReservation(reservationId);
  if (!existing || existing.status !== 'paid') return { ok: false, error: 'not_paid' };

  let timing: { start_at: string; end_at: string };
  try {
    timing = buildStartEnd(bookingDate, bookingTime, existing.duration_minutes);
  } catch (e) {
    return { ok: false, error: 'invalid_time', detail: (e as Error).message };
  }
  if (new Date(timing.start_at).getTime() < Date.now()) {
    return { ok: false, error: 'invalid_time', detail: 'slot in the past' };
  }

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update({
      booking_date: bookingDate,
      booking_time: bookingTime,
      start_at: timing.start_at,
      end_at: timing.end_at,
    })
    .eq('id', reservationId)
    .eq('status', 'paid')
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '23P01' || /exclu/i.test(error.message)) {
      return { ok: false, error: 'slot_taken' };
    }
    console.error('[bookings] reschedule failed:', error);
    return { ok: false, error: 'db_error', detail: error.message };
  }
  if (!data) return { ok: false, error: 'not_paid' };
  return { ok: true, booking: data as BookingRow };
}

/**
 * Records a completed refund reference against a declined booking.
 */
export async function recordRefund(reservationId: string, refundRef: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ refund_ref: refundRef, refunded_at: new Date().toISOString() })
    .eq('id', reservationId);
  if (error) console.error('[bookings] recordRefund failed:', error);
}

/**
 * Releases a pending reservation when the user closes the modal or the
 * countdown expires. No-op if the row already moved past pending.
 */
export async function releaseReservation(reservationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', reservationId)
    .eq('status', 'pending');
  if (error) console.error('[bookings] release failed:', error);
}

export async function getReservation(reservationId: string): Promise<BookingRow | null> {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', reservationId)
    .maybeSingle();
  if (error) {
    console.error('[bookings] getReservation failed:', error);
    return null;
  }
  return (data as BookingRow | null) ?? null;
}

/**
 * Live booking time-ranges for a given calendar date, used by the slot picker.
 * Includes pending reservations that haven't expired yet.
 */
export async function getLiveBookingRanges(dateStr: string): Promise<Array<{ start: Date; end: Date }>> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('start_at, end_at, status, expires_at')
    .eq('booking_date', dateStr);

  if (error) {
    console.error('[bookings] getLiveBookingRanges failed:', error);
    return [];
  }

  return (data ?? [])
    .filter((b: any) => {
      if (b.status === 'paid' || b.status === 'confirmed') return true;
      if (b.status === 'pending' && b.expires_at > nowIso) return true;
      return false;
    })
    .map((b: any) => ({ start: new Date(b.start_at), end: new Date(b.end_at) }));
}

/**
 * Paid bookings awaiting the owner's confirm/decline decision. No calendar
 * event exists yet — confirming creates it, declining refunds (PayPal).
 */
export async function getAwaitingDecision(): Promise<BookingRow[]> {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('status', 'paid')
    .order('start_at', { ascending: true });
  if (error) {
    console.error('[bookings] getAwaitingDecision failed:', error);
    return [];
  }
  return (data as BookingRow[]) ?? [];
}

/**
 * Confirmed upcoming bookings, for the admin overview.
 */
export async function getUpcomingBookings(limit = 25): Promise<BookingRow[]> {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('status', 'confirmed')
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('[bookings] getUpcomingBookings failed:', error);
    return [];
  }
  return (data as BookingRow[]) ?? [];
}
