// app/routes/api.calendar.ts
// Google Calendar integration + slot reservation lifecycle. Calendar access
// is via a server-side service account — no OAuth, no per-owner tokens.

import { isCalendarConfigured } from '~/lib/google.server';
import {
  getLiveBookingRanges,
  markPaid,
  releaseReservation,
  reserveSlot,
  type PaymentMethod,
} from '~/lib/bookings.server';
import { confirmReservationOnCalendar, fetchGoogleEventsForDate } from '~/lib/calendar.server';

interface TimeSlot {
  time: string;
  display: string;
  available: boolean;
}

const ALL_SLOTS: TimeSlot[] = [
  { time: '09:00', display: '9:00 AM', available: true },
  { time: '10:00', display: '10:00 AM', available: true },
  { time: '11:00', display: '11:00 AM', available: true },
  { time: '12:00', display: '12:00 PM', available: true },
  { time: '14:00', display: '2:00 PM', available: true },
  { time: '15:00', display: '3:00 PM', available: true },
  { time: '16:00', display: '4:00 PM', available: true },
  { time: '17:00', display: '5:00 PM', available: true },
  { time: '18:00', display: '6:00 PM', available: true },
];

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  switch (intent) {
    case 'getAvailableSlots':
      return getAvailableSlots(formData);
    case 'reserveSlot':
      return handleReserveSlot(formData);
    case 'releaseReservation':
      return handleReleaseReservation(formData);
    // confirmCashBooking: cash flow finalises here once the customer clicks
    // "Reserve Appointment" — there's no payment provider to call back.
    case 'confirmCashBooking':
      return handleConfirmCashBooking(formData);
    default:
      return Response.json({ error: 'Invalid intent' }, { status: 400 });
  }
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date) return Response.json({ error: 'Date parameter required' }, { status: 400 });
  return getAvailableSlotsForDate(date);
}

// ---- slot fetching ---------------------------------------------------------

async function getAvailableSlots(formData: FormData): Promise<Response> {
  const date = formData.get('date') as string;
  return getAvailableSlotsForDate(date);
}

async function getAvailableSlotsForDate(dateStr: string): Promise<Response> {
  // Live DB ranges (pending+paid+confirmed) — always queried, regardless of
  // whether Google Calendar is connected.
  const dbRanges = await getLiveBookingRanges(dateStr);

  // Google Calendar ranges — best-effort. If the service account isn't
  // configured we still honour DB reservations so the booking flow works
  // in dev.
  let googleRanges: Array<{ start: Date; end: Date }> = [];
  let warning: string | undefined;
  try {
    if (isCalendarConfigured()) {
      googleRanges = await fetchGoogleEventsForDate(dateStr);
    } else {
      warning = 'Calendar not configured — only DB reservations are checked';
    }
  } catch (err) {
    console.error('[api.calendar] google fetch failed:', err);
    warning = 'Calendar lookup failed — only DB reservations are checked';
  }

  const allBusy = [...dbRanges, ...googleRanges];
  const date = new Date(dateStr);
  const now = new Date();

  const slots = ALL_SLOTS.map((slot) => {
    const [h, m] = slot.time.split(':').map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 90 * 60_000); // assume up to 90 min

    const isPast = slotStart < now;
    const overlaps = allBusy.some(
      (r) => slotStart < r.end && slotEnd > r.start,
    );
    return { ...slot, available: !isPast && !overlaps };
  });

  return Response.json({ slots, ...(warning ? { warning } : {}) });
}

// ---- reservation lifecycle -------------------------------------------------

async function handleReserveSlot(formData: FormData): Promise<Response> {
  const paymentMethod = formData.get('paymentMethod') as PaymentMethod;
  if (!['paypal', 'valr', 'cash'].includes(paymentMethod)) {
    return Response.json({ error: 'invalid_payment_method' }, { status: 400 });
  }

  const result = await reserveSlot({
    service: (formData.get('service') as string) || '',
    duration: (formData.get('duration') as string) || '',
    customerName: (formData.get('customerName') as string) || '',
    customerPhone: (formData.get('customerPhone') as string) || '',
    bookingDate: (formData.get('bookingDate') as string) || '',
    bookingTime: (formData.get('bookingTime') as string) || '',
    isHomeCall: formData.get('isHomeCall') === 'true',
    paymentMethod,
  });

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      slot_taken: 409,
      invalid_service: 400,
      invalid_time: 400,
      db_error: 500,
    };
    return Response.json(
      { error: result.error, detail: result.detail },
      { status: statusMap[result.error] ?? 400 },
    );
  }

  return Response.json({
    reservationId: result.reservation.id,
    expiresAt: result.reservation.expires_at,
    amountZar: result.amountZar,
  });
}

async function handleReleaseReservation(formData: FormData): Promise<Response> {
  const reservationId = (formData.get('reservationId') as string) || '';
  if (!reservationId) return Response.json({ error: 'missing_reservation' }, { status: 400 });
  await releaseReservation(reservationId);
  return Response.json({ success: true });
}

async function handleConfirmCashBooking(formData: FormData): Promise<Response> {
  const reservationId = (formData.get('reservationId') as string) || '';
  if (!reservationId) return Response.json({ error: 'missing_reservation' }, { status: 400 });

  const paid = await markPaid(reservationId, 'CASH-PENDING');
  if (!paid.ok) {
    return Response.json({ error: paid.error }, { status: paid.error === 'reservation_expired' ? 410 : 500 });
  }

  const result = await confirmReservationOnCalendar(reservationId);
  return Response.json(result.responseBody, { status: result.status });
}

