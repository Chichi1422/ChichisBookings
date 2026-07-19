// app/routes/terms.tsx
// Booking terms, including the refund policy PayPal reviews look for.
// Static content — the owner should review the wording before treating it as
// final legal text (especially the cancellation terms).

import { Link } from 'react-router';

export function meta() {
  return [{ title: "Terms & Booking Policy | Chi Chi's Beauty Spa" }];
}

const h2 = 'font-playfair text-xl mt-8 mb-3 text-white';
const p = 'text-white/70 text-sm leading-relaxed mb-3';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-montserrat">
      <div className="max-w-2xl mx-auto py-10">
        <Link to="/" className="text-[#f48fb1] hover:text-[#f8bbd9] transition-colors text-sm">
          ← Back to Chi Chi's Beauty Spa
        </Link>
        <h1 className="font-playfair text-3xl mt-6 mb-2">Terms &amp; Booking Policy</h1>
        <p className="text-white/40 text-sm mb-8">Last updated: 19 July 2026</p>

        <h2 className={h2}>Bookings</h2>
        <p className={p}>
          A booking made on this website reserves your time slot and is{' '}
          <strong className="text-white">pending until we confirm it</strong>. We confirm
          bookings personally (usually via WhatsApp) as soon as we can. If we cannot
          accommodate your requested time, we will decline the booking and any payment you
          made will be refunded in full.
        </p>

        <h2 className={h2}>Prices and payment</h2>
        <p className={p}>
          All prices are in South African Rand (ZAR). Card and PayPal payments are
          processed by PayPal in USD or EUR — the amount shown at checkout is converted
          from the Rand price at the current exchange rate and is the amount you will be
          charged. Cash payments are made in Rand at your appointment; please arrive 10
          minutes early to complete payment.
        </p>

        <h2 className={h2}>Refunds</h2>
        <p className={p}>
          If we decline your booking, payments made via PayPal are refunded automatically
          in full to the same payment method. If a technical problem prevents your booking
          from being completed after you have paid, you will also be refunded in full.
        </p>

        <h2 className={h2}>Cancellations and rescheduling</h2>
        <p className={p}>
          Plans change — contact us on WhatsApp at{' '}
          <a
            href="https://wa.me/27633923033"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#f48fb1] hover:text-[#f8bbd9]"
          >
            +27 63 392 3033
          </a>{' '}
          as soon as possible to cancel or move your appointment, and at least 24 hours
          before your appointment time where you can. We will always try to find a time
          that works for you.
        </p>

        <h2 className={h2}>Home visits</h2>
        <p className={p}>
          Home-visit bookings include a call-out fee, shown before you pay. Please ensure
          we have accurate contact details so we can reach you on the day.
        </p>

        <h2 className={h2}>General</h2>
        <p className={p}>
          These terms are governed by the laws of South Africa. For anything not covered
          here, contact us on WhatsApp and we will sort it out. See also our{' '}
          <Link to="/privacy" className="text-[#f48fb1] hover:text-[#f8bbd9]">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
