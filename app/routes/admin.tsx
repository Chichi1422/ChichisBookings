// app/routes/admin.tsx
// Owner-only admin panel. Loader gates with assertOwner.

import { Form, Link, useLoaderData, useSearchParams, redirect } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { assertOwner } from '~/lib/auth.server';
import { isCalendarConfigured, verifyCalendarAccess } from '~/lib/google.server';
import { confirmReservationOnCalendar } from '~/lib/calendar.server';
import { refundCapture } from '~/lib/paypal.server';
import { sendAlert } from '~/lib/alerts.server';
import {
  getAwaitingDecision,
  getUpcomingBookings,
  getReservation,
  markDeclined,
  recordRefund,
  rescheduleBooking,
  type BookingRow,
} from '~/lib/bookings.server';
import {
  whatsappLink,
  confirmedMessage,
  declinedMessage,
  rescheduledMessage,
  inquiryMessage,
} from '~/lib/whatsapp';

const SLOT_TIMES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

export function meta() {
  return [{ title: "Admin | Chi Chi's Beauty Spa" }];
}

interface CalendarStatus {
  configured: boolean;
  error: string | null;
}

interface LoaderData {
  ownerEmail: string;
  calendar: CalendarStatus;
  awaitingDecision: BookingRow[];
  upcoming: BookingRow[];
  // The booking just confirmed/declined/rescheduled, so the UI can offer a
  // pre-filled WhatsApp message to the customer.
  justActioned: { booking: BookingRow; kind: 'confirmed' | 'declined' | 'rescheduled' } | null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await assertOwner(request);

  const configured = isCalendarConfigured();
  const [calendarError, awaitingDecision, upcoming] = await Promise.all([
    configured ? verifyCalendarAccess() : Promise.resolve('not_configured'),
    getAwaitingDecision(),
    getUpcomingBookings(25),
  ]);

  const url = new URL(request.url);
  const sent = url.searchParams.get('sent');
  let justActioned: LoaderData['justActioned'] = null;
  if (sent) {
    const booking = await getReservation(sent);
    if (booking) {
      const ok = url.searchParams.get('ok');
      const kind = ok === 'confirmed' ? 'confirmed' : ok === 'rescheduled' ? 'rescheduled' : 'declined';
      justActioned = { booking, kind };
    }
  }

  return new Response(
    JSON.stringify({
      ownerEmail: session.email,
      calendar: {
        configured,
        error: calendarError === 'not_configured' ? null : calendarError,
      },
      awaitingDecision,
      upcoming,
      justActioned,
    } satisfies LoaderData),
    {
      headers: { ...Object.fromEntries(session.headers), 'Content-Type': 'application/json' },
    },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await assertOwner(request);
  const fd = await request.formData();
  const intent = fd.get('intent') as string;
  const reservationId = ((fd.get('reservationId') as string) || '').trim();

  const back = (params: string) =>
    redirect(`/admin?${params}`, { headers: session.headers });

  if (!reservationId) return back('error=missing_reservation');

  if (intent === 'confirmBooking') {
    const result = await confirmReservationOnCalendar(reservationId);
    const body = result.responseBody;
    if (body?.success && !body?.warning) return back(`ok=confirmed&sent=${reservationId}`);
    if (body?.warning === 'payment_received_calendar_pending') return back('error=calendar_unreachable');
    return back(`error=${encodeURIComponent(body?.error || body?.warning || 'confirm_failed')}`);
  }

  if (intent === 'declineBooking') {
    const reservation = await getReservation(reservationId);
    if (!reservation) return back('error=reservation_missing');

    // Atomic paid → declined first, so a double-click can't double-refund.
    const declined = await markDeclined(reservationId);
    if (!declined.ok) return back('error=not_paid_or_already_handled');

    // Refund PayPal captures. Cash has nothing to refund; VALR (crypto) must be
    // refunded manually.
    const ref = reservation.payment_provider_ref;
    if (reservation.payment_method === 'paypal' && ref && ref !== 'CASH-PENDING') {
      const refund = await refundCapture(ref);
      if (!refund.ok) {
        await sendAlert('Decline refund FAILED — manual refund needed', [
          `A booking was declined but the PayPal refund failed.`,
          `Refund it manually in the PayPal dashboard.`,
          `Capture ID: ${ref}`,
          `Customer: ${reservation.customer_name} (${reservation.customer_phone})`,
          `Amount: ${reservation.paid_currency ?? 'ZAR'} ${reservation.paid_amount ?? reservation.amount_zar ?? '?'}`,
        ]);
        return back('error=declined_but_refund_failed');
      }
      if (refund.refundId) await recordRefund(reservationId, refund.refundId);
      return back(`ok=declined_refunded&sent=${reservationId}`);
    }
    return back(`ok=declined&sent=${reservationId}`);
  }

  if (intent === 'rescheduleBooking') {
    const bookingDate = ((fd.get('bookingDate') as string) || '').trim();
    const bookingTime = ((fd.get('bookingTime') as string) || '').trim();
    if (!bookingDate || !bookingTime) return back('error=missing_datetime');

    const result = await rescheduleBooking(reservationId, bookingDate, bookingTime);
    if (result.ok) return back(`ok=rescheduled&sent=${reservationId}`);
    return back(`error=${result.error}`);
  }

  return back('error=unknown_intent');
}

export default function Admin() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const [searchParams] = useSearchParams();
  // Derived from the URL (not useState) so dismissing — navigating to plain
  // /admin — actually clears it. State would survive the navigation.
  const message = (() => {
    const ok = searchParams.get('ok');
    const error = searchParams.get('error');
    const okText: Record<string, string> = {
      confirmed: 'Booking confirmed and added to the calendar.',
      declined: 'Booking declined.',
      declined_refunded: 'Booking declined and the PayPal payment was refunded.',
      rescheduled: 'Booking moved to the new time — still pending your confirmation.',
    };
    const errText: Record<string, string> = {
      calendar_unreachable: 'Payment stands, but the calendar could not be reached — try confirming again.',
      declined_but_refund_failed:
        'Booking declined, but the refund failed. Refund manually in the PayPal dashboard.',
      not_paid_or_already_handled: 'That booking was already handled.',
      reservation_missing: 'Booking not found.',
      slot_taken: 'That new time overlaps another booking — pick a different slot.',
      invalid_time: 'That date/time is invalid or in the past.',
      missing_datetime: 'Pick both a date and a time to reschedule.',
    };
    if (ok) return { type: 'success' as const, text: okText[ok] ?? 'Done.' };
    if (error) return { type: 'error' as const, text: errText[error] ?? `Error: ${error}` };
    return null;
  })();

  const calendarOk = data.calendar.configured && !data.calendar.error;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-playfair text-3xl">Admin Panel</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/50">{data.ownerEmail}</span>
            <Link to="/admin/pricing" className="text-[#f48fb1] hover:text-[#f8bbd9] transition-colors">
              Pricing & Services
            </Link>
            <Form method="post" action="/admin/logout">
              <button className="text-[#f48fb1] hover:text-[#f8bbd9] transition-colors">
                Sign out
              </button>
            </Form>
            <Link to="/" className="text-[#f48fb1] hover:text-[#f8bbd9] transition-colors">
              ← Back to Site
            </Link>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                : 'bg-red-500/20 border border-red-500/50 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {data.justActioned && (
          <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-medium">Let {data.justActioned.booking.customer_name} know</div>
              <div className="text-white/50">
                Opens WhatsApp with a pre-written{' '}
                {data.justActioned.kind === 'confirmed'
                  ? 'confirmation'
                  : data.justActioned.kind === 'rescheduled'
                  ? 'reschedule'
                  : 'decline'}{' '}
                message.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={whatsappLink(
                  data.justActioned.booking.customer_phone,
                  data.justActioned.kind === 'confirmed'
                    ? confirmedMessage(data.justActioned.booking)
                    : data.justActioned.kind === 'rescheduled'
                    ? rescheduledMessage(data.justActioned.booking)
                    : declinedMessage(data.justActioned.booking),
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#25D366] text-[#0a0a0a] text-sm font-semibold rounded-lg hover:brightness-110 transition-all"
              >
                Message on WhatsApp →
              </a>
              {/* Dismiss = drop the ok/sent params; message + banner are URL-derived. */}
              <Link
                to="/admin"
                replace
                aria-label="Dismiss"
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/15 text-white/60 hover:bg-white/10 transition-colors"
              >
                ✕
              </Link>
            </div>
          </div>
        )}

        {/* Google Calendar status */}
        <div className="gradient-border rounded-2xl p-6 mb-6">
          <h2 className="font-playfair text-xl mb-4">Google Calendar</h2>
          <p className="text-white/60 mb-4 text-sm">
            Bookings sync to a Google Calendar via a server-side service account.
            Set <code className="bg-white/10 px-1 py-0.5 rounded text-xs">GOOGLE_SERVICE_ACCOUNT_JSON</code>{' '}
            and <code className="bg-white/10 px-1 py-0.5 rounded text-xs">GOOGLE_CALENDAR_ID</code> on
            the host, and share the calendar with the service account email
            with "Make changes to events" permission.
          </p>
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                calendarOk ? 'bg-green-400' : data.calendar.configured ? 'bg-red-400' : 'bg-yellow-400'
              }`}
            />
            <span className="text-white/80">
              {calendarOk
                ? 'Connected'
                : data.calendar.configured
                ? 'Configured but not reachable'
                : 'Not configured'}
            </span>
          </div>
          {data.calendar.error && (
            <p className="mt-3 text-red-300 text-sm">
              {data.calendar.error}
            </p>
          )}
        </div>

        {/* Pending confirmation */}
        <div className="gradient-border rounded-2xl p-6 mb-6">
          <h2 className="font-playfair text-xl mb-2">Pending confirmation</h2>
          <p className="text-white/60 text-sm mb-4">
            Paid bookings awaiting your decision. Confirm to add it to the calendar, or
            decline to reject it (PayPal payments are refunded automatically).
          </p>
          {data.awaitingDecision.length === 0 ? (
            <p className="text-white/40 text-sm">Nothing waiting — you're all caught up.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {data.awaitingDecision.map((b) => {
                const paid =
                  b.paid_currency && b.paid_amount != null
                    ? `${b.paid_currency} ${Number(b.paid_amount).toFixed(2)}`
                    : b.payment_method === 'cash'
                    ? 'Cash on arrival'
                    : '—';
                return (
                  <li key={b.id} className="py-4 text-sm">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <div className="font-medium">{b.service} — {b.duration}</div>
                        <div className="text-white/60">
                          {b.customer_name} · {b.customer_phone} · {b.is_home_call ? 'Home' : 'Spa'}
                        </div>
                        <div className="text-white/40 text-xs mt-1">
                          {b.booking_date} {b.booking_time} · {b.payment_method.toUpperCase()}
                          {b.payment_provider_ref && b.payment_provider_ref !== 'CASH-PENDING'
                            ? ` · ${b.payment_provider_ref}`
                            : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#f48fb1] font-semibold">R{b.amount_zar ?? '—'}</div>
                        <div className="text-white/40 text-xs">paid {paid}</div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Form method="post">
                        <input type="hidden" name="intent" value="confirmBooking" />
                        <input type="hidden" name="reservationId" value={b.id} />
                        <button className="px-4 py-2 bg-green-500/90 text-[#0a0a0a] text-sm font-semibold rounded-lg hover:bg-green-400 transition-all">
                          Confirm
                        </button>
                      </Form>
                      <Form
                        method="post"
                        onSubmit={(e) => {
                          const msg =
                            b.payment_method === 'paypal'
                              ? `Decline this booking and refund the ${paid} PayPal payment?`
                              : 'Decline this booking?';
                          if (!confirm(msg)) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="intent" value="declineBooking" />
                        <input type="hidden" name="reservationId" value={b.id} />
                        <button className="px-4 py-2 border border-red-500/40 text-red-300 text-sm rounded-lg hover:bg-red-500/10 transition-all">
                          Decline{b.payment_method === 'paypal' ? ' & refund' : ''}
                        </button>
                      </Form>
                      <a
                        href={whatsappLink(b.customer_phone, inquiryMessage(b))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 border border-[#25D366]/40 text-[#25D366] text-sm rounded-lg hover:bg-[#25D366]/10 transition-all"
                      >
                        WhatsApp
                      </a>
                    </div>

                    {/* Reschedule to a new slot (stays pending confirmation) */}
                    <Form method="post" className="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-white/5">
                      <input type="hidden" name="intent" value="rescheduleBooking" />
                      <input type="hidden" name="reservationId" value={b.id} />
                      <label className="text-xs text-white/50">
                        <span className="block mb-1">New date</span>
                        <input
                          type="date"
                          name="bookingDate"
                          defaultValue={b.booking_date}
                          className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                        />
                      </label>
                      <label className="text-xs text-white/50">
                        <span className="block mb-1">New time</span>
                        <select
                          name="bookingTime"
                          defaultValue={b.booking_time?.slice(0, 5)}
                          className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                        >
                          {SLOT_TIMES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <button className="px-4 py-2 border border-white/20 text-white text-sm rounded-lg hover:bg-white/5 transition-all">
                        Reschedule
                      </button>
                    </Form>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Upcoming bookings */}
        <div className="gradient-border rounded-2xl p-6 mb-6">
          <h2 className="font-playfair text-xl mb-4">Upcoming bookings</h2>
          {data.upcoming.length === 0 ? (
            <p className="text-white/40 text-sm">No upcoming bookings.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {data.upcoming.map((b) => (
                <li key={b.id} className="py-3 text-sm flex justify-between items-start gap-4">
                  <div>
                    <div className="font-medium">{b.service} — {b.duration}</div>
                    <div className="text-white/60">
                      {b.customer_name} · {b.customer_phone}
                    </div>
                    <div className="text-white/40 text-xs mt-1">
                      {b.booking_date} {b.booking_time} · {b.is_home_call ? 'Home' : 'Spa'} · {b.status}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-[#f48fb1] font-semibold">R{b.amount_zar ?? '—'}</div>
                    {/* Re-send the confirmation any time — handles messaging
                        several customers in a row, not just the last action. */}
                    <a
                      href={whatsappLink(b.customer_phone, confirmedMessage(b))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 border border-[#25D366]/40 text-[#25D366] text-xs rounded-lg hover:bg-[#25D366]/10 transition-all"
                    >
                      WhatsApp
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick Links */}
        <div className="gradient-border rounded-2xl p-6">
          <h2 className="font-playfair text-xl mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 gap-4">
            <a
              href="https://developer.paypal.com/dashboard/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="font-semibold mb-1">PayPal Dashboard</div>
              <div className="text-sm text-white/50">Manage PayPal integration</div>
            </a>
            <a
              href="https://www.valr.com/settings/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="font-semibold mb-1">VALR API Keys</div>
              <div className="text-sm text-white/50">Manage VALR credentials</div>
            </a>
            <a
              href="https://console.cloud.google.com/iam-admin/serviceaccounts"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="font-semibold mb-1">Service Accounts</div>
              <div className="text-sm text-white/50">Manage calendar service account</div>
            </a>
            <a
              href="https://calendar.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="font-semibold mb-1">Google Calendar</div>
              <div className="text-sm text-white/50">View bookings</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
