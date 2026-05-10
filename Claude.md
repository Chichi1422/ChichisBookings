# Claude.md — Chi Chi's Beauty Spa

## Project Overview
React Router v7 full-stack web app for **Chi Chi's Beauty Spa** — a Fish Hoek, Cape Town-based beauty/wellness business. Customers select treatments, pick time slots, and pay via PayPal, VALR (crypto), or cash. Bookings sync to Google Calendar.

## Tech Stack
- **Framework:** React Router v7 (SSR, file-based routing)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (dark theme, pink accent `#f48fb1`)
- **Fonts:** Playfair Display (headings), Montserrat (body)
- **Payments:** PayPal (react-paypal-js), VALR Pay (crypto via REST API)
- **Calendar:** Google Calendar API (googleapis)
- **Build:** Vite 7, esbuild
- **Deploy:** Docker / Node

## Key Files
| Path | Purpose |
|---|---|
| `app/components/spa.tsx` | Main landing page component (services, gallery, contact, booking trigger) |
| `app/components/BookingModel.tsx` | Booking modal with multi-step flow (details → payment → confirm) |
| `app/routes/api.paypal.orders.ts` | PayPal order create/capture (server action) |
| `app/routes/api.valr.ts` | VALR Pay payment info generation & verification |
| `app/routes/api.calendar.ts` | Google Calendar slot fetching & event creation |
| `app/routes/api.auth.google.callback.ts` | Google OAuth callback |
| `app/routes/admin.tsx` | Admin panel for calendar connection & config |
| `app/routes/home.tsx` | Home route rendering `<ChiChisSpa />` |
| `app/app.css` | Global styles, animations, custom utilities |

## Architecture Notes
- Routes defined in `app/routes.ts` — both pages and API endpoints.
- API routes use `action()` with `FormData` + `intent` field for method dispatch.
- Google Calendar tokens stored in-memory (`storedTokens`) — **must migrate to DB for production**.
- PayPal converts ZAR → USD with a hardcoded rate — **must use live FX rate**.
- VALR integration uses HMAC-SHA512 signed requests.
- The old inline booking modal in `spa.tsx` is commented out; the `BookingModal` component is now used.

## Environment Variables Needed
```
PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE
VITE_PAYPAL_CLIENT_ID
VALR_API_KEY, VALR_API_SECRET, VALR_PAY_ID
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_CALENDAR_ID
APP_URL
BUSINESS_PHONE, BUSINESS_TIMEZONE
```

## Conventions
- Use `FormData` + `intent` pattern for all API route actions.
- Keep components in `app/components/`, routes in `app/routes/`.
- Currency is ZAR (South African Rand). Display as `R{amount}`.
- WhatsApp contact: `+27633923033`.
- Home call service adds R150 fee.

## Current Status
- UI and booking flow are functional.
- API integrations (PayPal, VALR, Google Calendar) are scaffolded and connected and tested **VALR integration hidden for now**
