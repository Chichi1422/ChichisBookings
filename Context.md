# Context.md — Chi Chi's Beauty Spa

## Business Context
Chi Chi's Beauty Spa is a wellness business in Fish Hoek, Cape Town, South Africa offering massage, reflexology, and pedicure services. They operate both from a physical spa location and via home service (mobile therapist, +R150 fee). Operating hours: Mon–Sun 9AM–7PM.

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

## Booking Flow
1. Customer selects a service and duration from the services grid.
2. Optionally toggles "Home Service" (adds R250).
3. Clicks "Continue to Book" → opens `BookingModal`.
4. **Step 1 — Details:** Name, phone, date, time slot selection.
   - Time slots fetched from `/api/calendar?date=YYYY-MM-DD`.
   - Falls back to hardcoded 9AM–6PM slots if calendar not connected.
5. **Step 2 — Payment:** Choose PayPal, VALR (crypto), or Cash.
   - **PayPal:** Creates order server-side, captures on approval.
   - **VALR:** Generates payment reference + deep link, customer pays externally, then clicks "I've Made the Payment" to verify.
   - **Cash:** Reserves appointment, customer pays on arrival.
6. **Step 3 — Processing:** Creates Google Calendar event via `/api/calendar` POST.
7. **Step 4 — Confirmed:** Shows summary, WhatsApp confirmation note.

## Payment Integration Details

### PayPal
- Server-side order creation and capture via `/api/paypal/orders`.
- ZAR → USD conversion needed (currently hardcoded rate).
- Uses `@paypal/react-paypal-js` on the client.

### VALR Pay
- Crypto payment via VALR exchange (South African platform).
- Server generates a unique reference, fetches live BTC/ETH/USDT prices.
- Customer pays via VALR app or web, then payment is verified against transaction history.
- HMAC-SHA512 authentication for all VALR API calls.

### Cash
- No payment processing — booking is created with `CASH-PENDING` transaction ID.

## Google Calendar Integration
- OAuth 2.0 flow initiated from `/admin` page.
- Callback at `/api/auth/google/callback` exchanges code for tokens.
- Tokens stored in-memory (not persistent — **production TODO**).
- Events created with service details, customer info, payment method in description.
- Color-coded: orange for home calls, green for in-spa.

## Contact
- Phone/WhatsApp: 063 392 3033
- WhatsApp link: `https://wa.me/27633923033`
- Location: Fish Hoek, Cape Town, South Africa
