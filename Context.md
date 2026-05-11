# Context.md — Chi Chi's Beauty Spa

## Business Context
Chi Chi's Beauty Spa is a wellness business in Fish Hoek, Cape Town, South Africa offering massage, reflexology, and pedicure services. They operate both from a physical spa location and via home service (mobile therapist, +R250 fee). Operating hours: Mon–Sun 9AM–7PM.

## Services & Pricing (ZAR)

| Service | 30 min | 60 min | 90 min |
|---|---|---|---|
| Swedish Massage / Aroma Therapy | R400 | R600 | R800 |
| Deep Tissue / Sports Massage | R500 | R700 | R900 |
| Hot Stone Therapy | R400 | R750 | R950 |
| Reflexology | R350 | — | — |
| Neck Shoulder and Back | R300 | R450 | — |
| Pedicure (no gel) | R300 | — | — |
| Pedicure (with gel) | R400 | — | — |

Home call fee: **R250** added to any service.

The authoritative price catalog lives in [`app/lib/services.server.ts`](app/lib/services.server.ts). The client never quotes the final price to the server — `reserveSlot` looks it up by `(service, duration)`.

## Booking Flow
1. Customer selects a service + duration from the services grid.
2. Optionally toggles "Home Service" (adds R250).
3. Clicks "Continue to Book" → opens `BookingModal`.
4. **Step 1 — Details:** name, phone, date, time slot, payment method.
   - Time slots fetched from `/api/calendar?date=YYYY-MM-DD`. Server returns the union of (Google Calendar events) ∪ (live DB reservations: `pending` + unexpired, `paid`, `confirmed`).
5. **Continue to Payment:** server-side `reserveSlot` runs first.
   - Inserts a `pending` row in `app.bookings`. Postgres `EXCLUDE` constraint atomically rejects overlaps with HTTP 409.
   - On success, server returns `{ reservationId, expiresAt, amountZar }`. Modal opens the payment step with a live countdown (10 min for card/crypto; until 24h-before-appointment for cash).
6. **Step 2 — Payment:** PayPal / VALR / Cash.
   - **PayPal:** `create` reads amount from the reservation row; `capture` calls `markPaid(reservationId, captureId)` → calendar insert → `markConfirmed`. Expired reservation triggers a PayPal refund.
   - **VALR:** `generatePaymentInfo` derives the reference as `CHI-${reservationId.slice(0,8)}`; `checkPayment` matches the VALR transaction history then runs the same `markPaid → calendar → markConfirmed` flow.
   - **Cash:** `confirmCashBooking` runs `markPaid('CASH-PENDING')` → calendar insert → `markConfirmed`.
7. **Step 3 — Processing:** server creates the Google Calendar event in `confirmReservationOnCalendar`.
8. **Step 4 — Confirmed:** summary + WhatsApp confirmation note. If the calendar event failed, the customer sees "payment received — we'll confirm shortly" and the admin sees the booking in the "needs manual sync" list.

## Reservation Lifecycle

```
              reserveSlot
                  │
            (EXCLUDE constraint)
                  ▼
              [pending]  ── 10 min TTL (paypal/valr) ─→ [expired]
                  │       (24h pre-appointment for cash)
       payment captured
                  ▼
               [paid]  ── calendar insert fails ─→ stays [paid] (manual sync)
                  │
        calendar event created
                  ▼
            [confirmed]
```

User-cancel paths set `status='cancelled'`. The exclusion-constraint predicate only considers rows in `('pending','paid','confirmed')`, so cancelled/expired rows free the slot immediately. A `BEFORE INSERT` trigger (`app.expire_overlapping_stale_pending`) flips any time-overlapping `pending` rows whose `expires_at` has passed to `expired` just before the constraint check, so a lapsed TTL never blocks the next booking. A `pg_cron` job sweeps the rest every 5 minutes for hygiene.

## Trust Boundary
- The browser **never** talks to Supabase directly. All persistence goes through React Router actions/loaders using the `SUPABASE_SERVICE_ROLE_KEY`.
- RLS is enabled on `app.oauth_tokens` and `app.bookings` with **no policies**. Anon key has zero data access; even if it leaked nothing reads or writes.
- The client never tells the server how much to charge — pricing comes from the server-side catalog, keyed by `(service, duration)`.

## Data Model

`app.oauth_tokens` (singleton, id=1) — Google Calendar refresh + access tokens. Auto-refreshed and persisted on rotation.

`app.bookings` — every reservation, paid booking, and confirmed booking. Status enum: `pending → paid → confirmed | expired | cancelled`. The `bookings_no_overlap` exclusion constraint is the single source of truth for slot availability.

## Payment Integration Details

### PayPal
- Server-side order creation and capture via `/api/paypal/orders` (intents `create` and `capture`).
- Order's `purchase_units[0].custom_id = reservationId` — the only piece of order metadata we trust on capture.
- ZAR → USD conversion uses a hardcoded rate (TODO: live FX feed).
- Uses `@paypal/react-paypal-js` on the client.
- Expired reservation on capture → server immediately calls PayPal refund and returns 410.

### VALR Pay
- Crypto payment via VALR exchange (South African platform).
- Reference is derived from `reservationId` so the lookup is unambiguous.
- HMAC-SHA512 authentication for all VALR API calls.
- UI is hidden for now; back-end remains wired.

### Cash
- `confirmCashBooking` intent on `/api/calendar` finalises the booking.
- Reservation TTL is set to 24h before the appointment so the owner can confirm manually.

## Google Calendar Integration
- OAuth 2.0 flow initiated from `/admin` (owner-gated).
- Callback at `/api/auth/google/callback` exchanges code for tokens. Owner-gated so an attacker hitting the redirect URI cannot overwrite the spa's tokens.
- Tokens persisted in `app.oauth_tokens` (Supabase) — survive Vercel cold starts.
- Events created with service details, customer info, payment method, and reservation id in description.
- Color-coded: orange for home calls, green for in-spa.

## Contact
- Phone/WhatsApp: 063 392 3033
- WhatsApp link: `https://wa.me/27633923033`
- Location: Fish Hoek, Cape Town, South Africa
