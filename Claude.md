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
| `app/lib/services.server.ts` | Authoritative catalog + pricing config, DB-backed (`getServiceCatalog`, `lookupService`, `getPricingConfig`) + admin CRUD |
| `app/lib/fx.server.ts` | ZAR→USD/EUR conversion — live cached rate + owner markup (`quoteAmount`) |
| `app/routes/api.paypal.orders.ts` | PayPal create/capture; currency-aware (USD/EUR); rejects without a live reservation; refunds on expired capture |
| `app/routes/api.paypal.webhook.ts` | Signature-verified `PAYMENT.CAPTURE.COMPLETED` reconciliation (crash-window safety net) |
| `app/lib/alerts.server.ts` | `sendAlert` — owner email on money-critical failures (Resend; no-op without `RESEND_API_KEY`) |
| `app/routes/api.valr.ts` | VALR Pay info + verification, keyed by `reservationId` |
| `app/routes/api.calendar.ts` | Slot fetch (DB ∪ Google), reserve/release intents, calendar event insert |
| `app/routes/api.fx.ts` | Live currency quote for a reservation (used by the booking modal) |
| `app/routes/auth.callback.ts` | Supabase magic-link PKCE callback |
| `app/routes/admin.tsx` | Admin panel — calendar status, manual-sync queue, upcoming bookings |
| `app/routes/admin.pricing.tsx` | Owner-only pricing & service CRUD; FX markup + home-call fee |
| `app/routes/admin.login.tsx` | Magic-link sign-in (only `OWNER_EMAIL` accepted) |
| `app/routes/admin.logout.tsx` | Sign-out action |
| `supabase/migrations/0001_init.sql` | Schema — `oauth_tokens`, `bookings` (with EXCLUDE constraint) |
| `supabase/migrations/0002_cron_expire.sql` | `pg_cron` job that expires stale pending bookings |
| `supabase/migrations/0004_pricing.sql` | Catalog tables (`service_groups`/`service_options`), `pricing_config`, `fx_rates` |
| `supabase/migrations/0005_confirm_decline.sql` | Adds `declined` status + refund columns for the owner confirm/decline gate |

## Architecture Notes
- Routes defined in `app/routes.ts` — both pages and API endpoints.
- API routes use `action()` with `FormData` + `intent` field for method dispatch.
- **Persistence:** Supabase (Postgres) accessed only from server modules using `SUPABASE_SERVICE_ROLE_KEY`. Client never imports Supabase. RLS is enabled on `app.*` with no policies — anon has zero access.
- **Google Calendar:** server-side **service account** (`GOOGLE_SERVICE_ACCOUNT_JSON`). The spa shares one calendar (`GOOGLE_CALENDAR_ID`) with the service account email and grants "Make changes to events". No OAuth, no refresh tokens, no per-owner consent flow.
- **Owner-only admin** via Supabase magic link. `OWNER_EMAIL` is the only address that can sign in. `assertOwner(request)` gates `/admin` and any future admin-only endpoints.
- **Booking concurrency:** Postgres `EXCLUDE USING gist` on `tstzrange(start_at, end_at)` enforces no double-booking atomically. Slot is reserved (`status='pending'`, TTL 10 min for PayPal/VALR, until 24h-before-appointment for cash) **before** the payment screen opens. A `BEFORE INSERT` trigger expires overlapping stale-pending rows just-in-time so a lapsed TTL never blocks the next booking; a 5-minute `pg_cron` job sweeps the rest. PayPal `custom_id` carries `reservationId`; capture re-validates and refunds on expiry.
- **Owner confirm/decline gate:** payment does **not** auto-confirm. A captured booking sits at `status='paid'` and appears in the admin's "Pending confirmation" list. The owner **confirms** (→ `confirmReservationOnCalendar` creates the calendar event → `status='confirmed'`) or **declines** (`markDeclined` flips `paid`→`declined` atomically, then PayPal captures are refunded via `refundCapture`; cash needs no refund, VALR is refunded manually). `declined` is outside the overlap constraint, so declining frees the slot. Customers are told payment was received and the booking is *pending confirmation* — never told it's confirmed prematurely. No automated customer notification exists yet; the owner messages via WhatsApp.
- **Calendar failure path:** if `events.insert` fails during confirmation, `markConfirmed` isn't reached, the row stays at `status='paid'`, and it remains in "Pending confirmation" for the owner to retry. The customer is never told a booking is on the calendar when it isn't.
- **Pricing:** ZAR is the base/source-of-truth price, stored in `app.service_groups`/`app.service_options` and managed from `/admin/pricing`. PayPal cannot process ZAR, so card payments are charged in USD/EUR, converted at checkout by `app/lib/fx.server.ts` (live cached rate + owner-set markup %). ZAR-native payment is cash/VALR only.
- **Payment reconciliation + alerting:** `/api/paypal/webhook` (signature-verified) is the safety net for the crash window between PayPal capturing and `markPaid` recording — it records missed captures or refunds orphaned ones. The sync capture path has a race guard so a webhook that wins the race isn't mistaken for an expired reservation (which would wrongly refund). Money-critical failures (refund failed, capture flow crashed, calendar insert failed) email the owner via `sendAlert`.
- **Legal pages:** `/privacy` (POPIA) and `/terms` (incl. refund policy). Linked from the footer and the payment step. Owner should review wording before treating as final legal text.
- VALR integration uses HMAC-SHA512 signed requests.
- The old inline booking modal in `spa.tsx` is commented out; the `BookingModal` component is used.
- CI (`.github/workflows/ci.yml`) runs typecheck + build on every PR and push to main.

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
- Home-call fee and FX markup are owner-managed in `app.pricing_config` (edit at `/admin/pricing`); `DEFAULT_HOME_CALL_FEE_ZAR` is only a fallback if the row is unreadable.

## Current Status
- UI and booking flow are functional; live at chichisbeauty.com (www is canonical).
- Slot-reservation pipeline fixes the previous race condition.
- Admin panel is owner-gated; confirm/decline/reschedule with click-to-send WhatsApp.
- API integrations (PayPal, VALR, Google Calendar) are scaffolded and tested. **VALR integration hidden in UI for now.**
- **PayPal is still in SANDBOX mode.** Go-live checklist (all must change together, then redeploy):
  1. `PAYPAL_MODE=live`
  2. Live `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`
  3. Live `VITE_PAYPAL_CLIENT_ID` (build-time — requires the redeploy)
  4. New `PAYPAL_WEBHOOK_ID` — **webhooks are per-app**: the live app needs its own webhook created in the PayPal dashboard (same URL, `PAYMENT.CAPTURE.COMPLETED`); the sandbox webhook id will NOT work
- PII at rest (customer name/phone) is AES-256-GCM encrypted via `app/lib/crypto.server.ts` (`PII_ENCRYPTION_KEY`). Legacy plaintext rows read back fine (`enc:v1:` prefix discriminates).
- Sentry (free tier) wired: `SENTRY_DSN` (server chokepoints) + `VITE_SENTRY_DSN` (browser).
