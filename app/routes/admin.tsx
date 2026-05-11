// app/routes/admin.tsx
// Owner-only admin panel. Loader gates with assertOwner.

import { useState } from 'react';
import { Form, Link, useLoaderData, useSearchParams } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { assertOwner } from '~/lib/auth.server';
import { isCalendarConnected } from '~/lib/google-tokens.server';
import {
  getNeedsManualSync,
  getUpcomingBookings,
  type BookingRow,
} from '~/lib/bookings.server';

export function meta() {
  return [{ title: "Admin | Chi Chi's Beauty Spa" }];
}

interface LoaderData {
  ownerEmail: string;
  calendarConnected: boolean;
  needsManualSync: BookingRow[];
  upcoming: BookingRow[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await assertOwner(request);

  const [calendarConnected, needsManualSync, upcoming] = await Promise.all([
    isCalendarConnected(),
    getNeedsManualSync(),
    getUpcomingBookings(25),
  ]);

  return new Response(
    JSON.stringify({
      ownerEmail: session.email,
      calendarConnected,
      needsManualSync,
      upcoming,
    } satisfies LoaderData),
    {
      headers: { ...Object.fromEntries(session.headers), 'Content-Type': 'application/json' },
    },
  );
}

export default function Admin() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success === 'calendar_connected') return { type: 'success', text: 'Google Calendar connected.' };
    if (error) return { type: 'error', text: `Authentication failed: ${error}` };
    return null;
  });

  const connectCalendar = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('intent', 'getAuthUrl');
      const response = await fetch('/api/calendar', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
      else setMessage({ type: 'error', text: 'Failed to get authentication URL' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to connect to Google Calendar' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-playfair text-3xl">Admin Panel</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/50">{data.ownerEmail}</span>
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

        {/* Google Calendar */}
        <div className="gradient-border rounded-2xl p-6 mb-6">
          <h2 className="font-playfair text-xl mb-4">Google Calendar</h2>
          <p className="text-white/60 mb-4">
            Connect your Google Calendar to automatically sync bookings and manage availability.
          </p>
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${data.calendarConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-white/80">
              {data.calendarConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <button
            onClick={connectCalendar}
            disabled={loading}
            className="mt-4 px-6 py-3 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all disabled:opacity-50"
          >
            {loading ? 'Connecting...' : data.calendarConnected ? 'Reconnect Calendar' : 'Connect Google Calendar'}
          </button>
        </div>

        {/* Needs manual sync */}
        <div className="gradient-border rounded-2xl p-6 mb-6">
          <h2 className="font-playfair text-xl mb-2">Needs manual calendar sync</h2>
          <p className="text-white/60 text-sm mb-4">
            Bookings where payment was received but the calendar event could not be created.
          </p>
          {data.needsManualSync.length === 0 ? (
            <p className="text-white/40 text-sm">Nothing to sync — all paid bookings are on the calendar.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {data.needsManualSync.map((b) => (
                <li key={b.id} className="py-3 text-sm">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="font-medium">{b.service} — {b.duration}</div>
                      <div className="text-white/60">
                        {b.customer_name} · {b.customer_phone} · {b.is_home_call ? 'Home' : 'Spa'}
                      </div>
                      <div className="text-white/40 text-xs mt-1">
                        {b.booking_date} {b.booking_time} · {b.payment_method.toUpperCase()}
                        {b.payment_provider_ref ? ` · ${b.payment_provider_ref}` : ''}
                      </div>
                    </div>
                    <div className="text-[#f48fb1] font-semibold">R{b.amount_zar ?? '—'}</div>
                  </div>
                </li>
              ))}
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
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="font-semibold mb-1">Google Cloud</div>
              <div className="text-sm text-white/50">Calendar API settings</div>
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
