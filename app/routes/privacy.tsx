// app/routes/privacy.tsx
// POPIA-aware privacy policy. Static content — the owner should review the
// wording before treating it as final legal text.

import { Link } from 'react-router';

export function meta() {
  return [{ title: "Privacy Policy | Chi Chi's Beauty Spa" }];
}

const h2 = 'font-playfair text-xl mt-8 mb-3 text-white';
const p = 'text-white/70 text-sm leading-relaxed mb-3';
const li = 'text-white/70 text-sm leading-relaxed mb-1 ml-5 list-disc';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-montserrat">
      <div className="max-w-2xl mx-auto py-10">
        <Link to="/" className="text-[#f48fb1] hover:text-[#f8bbd9] transition-colors text-sm">
          ← Back to Chi Chi's Beauty Spa
        </Link>
        <h1 className="font-playfair text-3xl mt-6 mb-2">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-8">Last updated: 19 July 2026</p>

        <p className={p}>
          Chi Chi's Beauty Spa ("we", "us") is a beauty and wellness business based in Fish
          Hoek, Cape Town, South Africa. This policy explains what personal information we
          collect when you use this website, why we collect it, and your rights under the
          Protection of Personal Information Act (POPIA).
        </p>

        <h2 className={h2}>What we collect</h2>
        <ul className="mb-3">
          <li className={li}>Your name and phone number, which you provide when booking.</li>
          <li className={li}>Your booking details: the treatment, date, time, and whether it is a home visit.</li>
          <li className={li}>
            A payment reference from your payment provider (for example a PayPal transaction
            id). We never see or store your card number or banking credentials — card
            payments are processed entirely by PayPal.
          </li>
        </ul>

        <h2 className={h2}>Why we collect it</h2>
        <p className={p}>
          Solely to provide your appointment: reserving your time slot, taking payment,
          confirming your booking, contacting you about it (including via WhatsApp), and
          processing refunds where applicable. We do not sell or share your information for
          marketing, and we do not send marketing messages.
        </p>

        <h2 className={h2}>Who processes it</h2>
        <p className={p}>
          Your information is stored and processed by the service providers that run this
          website: Supabase (database hosting), Vercel (website hosting), Google Calendar
          (appointment scheduling), PayPal (card payments), VALR (cryptocurrency payments,
          where offered), and Resend (transactional email). Each processes data only as
          needed to provide their service.
        </p>

        <h2 className={h2}>How long we keep it</h2>
        <p className={p}>
          Booking records are kept as part of our business and accounting records. You may
          ask us to delete your personal information at any time; we will do so unless a law
          (such as tax record-keeping) requires us to keep it.
        </p>

        <h2 className={h2}>Your rights</h2>
        <p className={p}>
          Under POPIA you may ask what personal information we hold about you, ask us to
          correct it, or ask us to delete it. Contact us on WhatsApp at{' '}
          <a
            href="https://wa.me/27633923033"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#f48fb1] hover:text-[#f8bbd9]"
          >
            +27 63 392 3033
          </a>{' '}
          and we will respond as soon as we can. If you are not satisfied with our response,
          you may lodge a complaint with the Information Regulator (South Africa).
        </p>
      </div>
    </div>
  );
}
