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
- **Persistence:** Supabase (Postgres + Auth) — server-side only via service role
- **Build:** Vite 7, esbuild
- **Deploy:** Vercel (production) via `@vercel/react-router`; Dockerfile retained as a self-host fallback

## Key Files
| Path | Purpose |
|---|---|
| `app/components/spa.tsx` | Main landing page component (services, gallery, contact, booking trigger) |
| `app/components/BookingModel.tsx` | Booking modal — reserves slot before payment, runs countdown, confirms after capture |
| `app/lib/supabase.server.ts` | Service-role + cookie-bound Supabase clients |
| `app/lib/auth.server.ts` | `assertOwner(request)` — owner gate for every admin surface |
| `app/lib/bookings.server.ts` | Reservation lifecycle (`reserveSlot`, `markPaid`, `markConfirmed`, `releaseReservation`) |
| `app/lib/google.server.ts` | Service-account-based Google Calendar client (`GOOGLE_SERVICE_ACCOUNT_JSON`) |
| `app/lib/calendar.server.ts` | Calendar event creation + slot fetching used by booking flows |
| `app/lib/services.server.ts` | Authoritative service catalog — server-side price lookup |
| `app/routes/api.paypal.orders.ts` | PayPal create/capture; rejects without a live reservation; refunds on expired capture |
| `app/routes/api.valr.ts` | VALR Pay info + verification, keyed by `reservationId` |
| `app/routes/api.calendar.ts` | Slot fetch (DB ∪ Google), reserve/release intents, calendar event insert |
| `app/routes/auth.callback.ts` | Supabase magic-link PKCE callback |
| `app/routes/admin.tsx` | Admin panel — calendar status, manual-sync queue, upcoming bookings |
| `app/routes/admin.login.tsx` | Magic-link sign-in (only `OWNER_EMAIL` accepted) |
| `app/routes/admin.logout.tsx` | Sign-out action |
| `supabase/migrations/0001_init.sql` | Schema — `oauth_tokens`, `bookings` (with EXCLUDE constraint) |
| `supabase/migrations/0002_cron_expire.sql` | `pg_cron` job that expires stale pending bookings |

## Architecture Notes
- Routes defined in `app/routes.ts` — both pages and API endpoints.
- API routes use `action()` with `FormData` + `intent` field for method dispatch.
- **Persistence:** Supabase (Postgres) accessed only from server modules using `SUPABASE_SERVICE_ROLE_KEY`. Client never imports Supabase. RLS is enabled on `app.*` with no policies — anon has zero access.
- **Google Calendar:** server-side **service account** (`GOOGLE_SERVICE_ACCOUNT_JSON`). The spa shares one calendar (`GOOGLE_CALENDAR_ID`) with the service account email and grants "Make changes to events". No OAuth, no refresh tokens, no per-owner consent flow.
- **Owner-only admin** via Supabase magic link. `OWNER_EMAIL` is the only address that can sign in. `assertOwner(request)` gates `/admin` and any future admin-only endpoints.
- **Booking concurrency:** Postgres `EXCLUDE USING gist` on `tstzrange(start_at, end_at)` enforces no double-booking atomically. Slot is reserved (`status='pending'`, TTL 10 min for PayPal/VALR, until 24h-before-appointment for cash) **before** the payment screen opens. A `BEFORE INSERT` trigger expires overlapping stale-pending rows just-in-time so a lapsed TTL never blocks the next booking; a 5-minute `pg_cron` job sweeps the rest. PayPal `custom_id` carries `reservationId`; capture re-validates and refunds on expiry.
- **Calendar failure path:** if `events.insert` fails after payment captures, the booking row stays at `status='paid'` and surfaces in the admin's "needs manual sync" list. The customer is told payment was received and confirmation will follow — never silently lied to.
- PayPal converts ZAR → USD with a hardcoded rate — **TODO: live FX rate**.
- VALR integration uses HMAC-SHA512 signed requests.
- The old inline booking modal in `spa.tsx` is commented out; the `BookingModal` component is used.

## Environment Variables Needed
See `.env.example` for the full list. Required:
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
OWNER_EMAIL
APP_URL, BUSINESS_PHONE, BUSINESS_TIMEZONE
PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE
VITE_PAYPAL_CLIENT_ID
VALR_API_KEY, VALR_API_SECRET, VALR_PAY_ID
GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_CALENDAR_ID
```

## Conventions
- Use `FormData` + `intent` pattern for all API route actions.
- Keep components in `app/components/`, routes in `app/routes/`, server libs in `app/lib/`.
- Server-only modules end in `.server.ts` so the bundler keeps them off the client.
- Currency is ZAR (South African Rand). Display as `R{amount}`. Prices are looked up server-side via `app/lib/services.server.ts`; never trust client-supplied amounts.
- WhatsApp contact: `+27633923033`.
- Home call service adds R250 fee (see `HOME_CALL_FEE_ZAR`).

## Current Status
- UI and booking flow are functional.
- Slot-reservation pipeline fixes the previous race condition.
- Admin panel is owner-gated; tokens persisted in Supabase.
- API integrations (PayPal, VALR, Google Calendar) are scaffolded and tested. **VALR integration hidden in UI for now.**
