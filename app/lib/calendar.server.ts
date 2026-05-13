// Server-only Google Calendar helpers shared across payment routes.
// Uses the service-account client from google.server.ts — no OAuth tokens.

import { getCalendarClient, getCalendarId } from './google.server';
import { getReservation, markConfirmed } from './bookings.server';

interface ConfirmResponse {
  status: number;
  responseBody: any;
}

/**
 * Inserts the calendar event for an already-paid reservation and flips the
 * row to 'confirmed'. If the calendar insert fails, the row stays at 'paid'
 * — admin sees it in the manual-sync list. We don't pretend it succeeded.
 */
export async function confirmReservationOnCalendar(
  reservationId: string,
): Promise<ConfirmResponse> {
  const reservation = await getReservation(reservationId);
  if (!reservation) {
    return { status: 404, responseBody: { error: 'reservation_missing' } };
  }
  if (reservation.status === 'confirmed' && reservation.google_event_id) {
    return {
      status: 200,
      responseBody: {
        success: true,
        eventId: reservation.google_event_id,
        booking: reservation,
      },
    };
  }
  if (reservation.status !== 'paid') {
    return { status: 409, responseBody: { error: 'not_paid' } };
  }

  let eventId: string | null | undefined;
  try {
    const calendar = getCalendarClient();

    const event = {
      summary: `🧖‍♀️ ${reservation.service} - ${reservation.customer_name}`,
      description: [
        `Service: ${reservation.service}`,
        `Duration: ${reservation.duration}`,
        `Customer: ${reservation.customer_name}`,
        `Phone: ${reservation.customer_phone}`,
        `Type: ${reservation.is_home_call ? '🏠 Home Service' : '🏪 At Spa'}`,
        `Payment: ${reservation.payment_method.toUpperCase()}` +
          (reservation.payment_provider_ref ? ` (${reservation.payment_provider_ref})` : ''),
        `Reservation: ${reservation.id}`,
      ].join('\n'),
      start: {
        dateTime: reservation.start_at,
        timeZone: process.env.BUSINESS_TIMEZONE || 'Africa/Johannesburg',
      },
      end: {
        dateTime: reservation.end_at,
        timeZone: process.env.BUSINESS_TIMEZONE || 'Africa/Johannesburg',
      },
      colorId: reservation.is_home_call ? '6' : '2',
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    };

    const created = await calendar.events.insert({
      calendarId: getCalendarId(),
      requestBody: event,
    });
    eventId = created.data.id;
  } catch (err) {
    // Payment captured, calendar failed. Row stays at 'paid' so admin can
    // sync manually. Do not lie to the customer.
    console.error('[calendar] insert failed:', err);
    return {
      status: 200,
      responseBody: {
        success: true,
        warning: 'payment_received_calendar_pending',
        booking: reservation,
      },
    };
  }

  if (!eventId) {
    return {
      status: 200,
      responseBody: {
        success: true,
        warning: 'payment_received_calendar_pending',
        booking: reservation,
      },
    };
  }

  const confirmed = await markConfirmed(reservationId, eventId);
  if (!confirmed.ok) {
    console.error('[calendar] markConfirmed failed after insert:', confirmed);
    return {
      status: 200,
      responseBody: {
        success: true,
        eventId,
        booking: reservation,
        warning: 'db_confirm_failed_check_admin',
      },
    };
  }

  return {
    status: 200,
    responseBody: {
      success: true,
      eventId,
      booking: confirmed.booking,
    },
  };
}

/**
 * Fetches Google Calendar event ranges for a given local-date string,
 * used by the slot picker. Throws if the calendar isn't reachable.
 */
export async function fetchGoogleEventsForDate(
  dateStr: string,
): Promise<Array<{ start: Date; end: Date }>> {
  const calendar = getCalendarClient();

  const date = new Date(dateStr);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const events = await calendar.events.list({
    calendarId: getCalendarId(),
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (events.data.items || []).map((event) => ({
    start: new Date(event.start?.dateTime || event.start?.date || ''),
    end: new Date(event.end?.dateTime || event.end?.date || ''),
  }));
}
