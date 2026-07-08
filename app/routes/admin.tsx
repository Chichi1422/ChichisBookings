// app/routes/admin.tsx
// Owner-only admin panel. Loader gates with assertOwner.

import { useState } from 'react';
import { Form, Link, useLoaderData, useSearchParams, redirect } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { assertOwner } from '~/lib/auth.server';
import { isCalendarConfigured, verifyCalendarAccess } from '~/lib/google.server';
import { confirmReservationOnCalendar } from '~/lib/calendar.server';
import { refundCapture } from '~/lib/paypal.server';
import {
  getAwaitingDecision,
  getUpcomingBookings,
  getReservation,
  markDeclined,
  recordRefund,
  type BookingRow,
} from '~/lib/bookings.server';

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
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await assertOwner(request);

  const configured = isCalendarConfigured();
  const [calendarError, awaitingDecision, upcoming] = await Promise.all([
    configured ? verifyCalendarAccess() : Promise.resolve('not_configured'),
    getAwaitingDecision(),
    getUpcomingBookings(25),
  ]);

  return new Response(
    JSON.stringify({
      ownerEmail: session.email,
      calendar: {
        configured,
        error: calendarError === 'not_configured' ? null : calendarError,
      },
      awaitingDecision,
      upcoming,
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
    if (body?.success && !body?.warning) return back('ok=confirmed');
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
      if (!refund.ok) return back('error=declined_but_refund_failed');
      if (refund.refundId) await recordRefund(reservationId, refund.refundId);
      return back('ok=declined_refunded');
    }
    return back('ok=declined');
  }

  return back('error=unknown_intent');
}

export default function Admin() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const [searchParams] = useSearchParams();
  const [message] = useState<{ type: 'success' | 'error'; text: string } | null>(() => {
    const ok = searchParams.get('ok');
    const error = searchParams.get('error');
    const okText: Record<string, string> = {
      confirmed: 'Booking confirmed and added to the calendar.',
      declined: 'Booking declined.',
      declined_refunded: 'Booking declined and the PayPal payment was refunded.',
    };
    const errText: Record<string, string> = {
      calendar_unreachable: 'Payment stands, but the calendar could not be reached — try confirming again.',
      declined_but_refund_failed:
        'Booking declined, but the refund failed. Refund manually in the PayPal dashboard.',
      not_paid_or_already_handled: 'That booking was already handled.',
      reservation_missing: 'Booking not found.',
    };
    if (ok) return { type: 'success', text: okText[ok] ?? 'Done.' };
    if (error) return { type: 'error', text: errText[error] ?? `Error: ${error}` };
    return null;
  });

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
                    </div>
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
                  <div className="text-[#f48fb1] font-semibold">R{b.amount_zar ?? '—'}</div>
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
