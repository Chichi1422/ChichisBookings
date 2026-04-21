# References.md — Chi Chi's Beauty Spa

## Framework & Build

- **React Router v7 Docs:** https://reactrouter.com/
- **Vite:** https://vite.dev/
- **Tailwind CSS v4:** https://tailwindcss.com/docs

## Payment APIs

### PayPal
- **Dashboard:** https://developer.paypal.com/dashboard/
- **Orders API (v2):** https://developer.paypal.com/docs/api/orders/v2/
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
- **OAuth 2.0 Scopes:** `https://www.googleapis.com/auth/calendar`
- **Google Cloud Console:** https://console.cloud.google.com/

## Currency & Exchange

- **ZAR/USD rates:** Consider using an API like https://exchangeratesapi.io/ or https://openexchangerates.org/ for live conversion (currently hardcoded).

## Deployment

- **Docker:** Dockerfile included — multi-stage Node 20 Alpine build.
- **Ngrok (dev tunneling):** Currently allowed host: `anita-radiophonic-gametically.ngrok-free.dev`

## TODO — Integration Checklist

- [ ] Add PayPal credentials to `.env` and test sandbox flow end-to-end
- [ ] Add VALR API keys to `.env` and test payment info generation + verification
- [ ] Set up Google Cloud project, enable Calendar API, create OAuth credentials
- [ ] Connect Google Calendar from `/admin` page and test booking creation
- [ ] Replace hardcoded ZAR→USD rate with live exchange rate API
- [ ] Persist Google Calendar tokens in a database (currently in-memory)
- [ ] Add WhatsApp notification (e.g., via Twilio or WhatsApp Business API)
- [ ] Add input validation and rate limiting on API routes
- [ ] Set up production environment variables and deploy
