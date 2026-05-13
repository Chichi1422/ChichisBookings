# References.md — Chi Chi's Beauty Spa

## Framework & Build

- **React Router v7 Docs:** https://reactrouter.com/
- **Vite:** https://vite.dev/
- **Tailwind CSS v4:** https://tailwindcss.com/docs

## Hosting & Persistence

- **Vercel React Router preset:** https://vercel.com/docs/frameworks/react-router
- **Supabase:** https://supabase.com/docs
- **Supabase Auth (Magic Link):** https://supabase.com/docs/guides/auth/auth-email-passwordless
- **Supabase SSR helpers:** https://supabase.com/docs/guides/auth/server-side
- **Postgres `EXCLUDE` constraints:** https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-EXCLUDE
- **`pg_cron` on Supabase:** https://supabase.com/docs/guides/database/extensions/pg_cron
- **Supabase explicit grants rollout (2026-05-30 / 2026-10-30):** new and existing projects will stop auto-granting Data API access on table creation. `supabase/migrations/0003_grants.sql` adds the explicit `service_role` grants (and `ALTER DEFAULT PRIVILEGES`) needed for `app.*` to keep working past those dates.

## Payment APIs

### PayPal
- **Dashboard:** https://developer.paypal.com/dashboard/
- **Orders API (v2):** https://developer.paypal.com/docs/api/orders/v2/
- **`custom_id` on purchase units:** https://developer.paypal.com/docs/api/orders/v2/#orders_create
- **Refunds API:** https://developer.paypal.com/docs/api/payments/v2/#captures_refund
- **react-paypal-js:** https://github.com/paypal/react-paypal-js
- **Sandbox Testing:** https://developer.paypal.com/tools/sandbox/

### VALR
- **API Docs:** https://docs.valr.com/
- **Authentication (HMAC):** https://docs.valr.com/#section/Authentication
- **Market Summary:** `GET /v1/public/{pair}/marketsummary`
- **Transaction History:** `GET /v1/account/transactionhistory`
- **VALR Pay:** https://www.valr.com/pay
- **API Key Management:** https://www.valr.com/settings/api-keys

## Google Calendar

- **Calendar API Docs:** https://developers.google.com/calendar/api/v3/reference
- **Node.js Quickstart:** https://developers.google.com/calendar/api/quickstart/nodejs
- **googleapis npm:** https://www.npmjs.com/package/googleapis
- **Service accounts overview:** https://cloud.google.com/iam/docs/service-account-overview
- **Authenticate via GoogleAuth with a service account JSON key:** https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest
- **Calendar access scope:** `https://www.googleapis.com/auth/calendar`
- **Google Cloud Console — Service Accounts:** https://console.cloud.google.com/iam-admin/serviceaccounts

## Currency & Exchange

- **ZAR/USD rates:** Consider using an API like https://exchangeratesapi.io/ or https://openexchangerates.org/ for live conversion (currently hardcoded).

## Deployment

- **Vercel:** Production target — `vercel.json` pins region `fra1` (closest to South Africa).
- **Docker:** Dockerfile retained as a self-host fallback (multi-stage Node 20 Alpine build).
- **Ngrok (dev tunneling):** Currently allowed host: `anita-radiophonic-gametically.ngrok-free.dev`

## TODO — Integration Checklist

- [x] Add PayPal credentials to `.env` and test sandbox flow end-to-end
- [x] Add VALR API keys to `.env` and test payment info generation + verification
- [x] Set up Google Cloud project, enable Calendar API, create a service account, download its JSON key, share the target calendar with the service account's `client_email`
- [x] Configure `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_CALENDAR_ID` env vars and confirm green status in `/admin`
- [ ] Replace hardcoded ZAR→USD rate with live exchange rate API (PayPal flow)
- [x] Owner-only admin access (Supabase magic link, gated by `OWNER_EMAIL`)
- [x] Atomic slot reservation to prevent double-bookings (Postgres `EXCLUDE` on `tstzrange`)
- [ ] Drop `app.oauth_tokens` table in a future migration (left in place from the OAuth-based implementation)
- [ ] Add WhatsApp notification (e.g., via Twilio or WhatsApp Business API)
- [ ] Add input validation and rate limiting on API routes
- [ ] Run `supabase db push` (or apply `supabase/migrations/*.sql` in the dashboard) against the production project
- [ ] Configure Vercel project env vars (see `.env.example`) and deploy
