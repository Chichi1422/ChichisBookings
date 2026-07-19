// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Main pages
  index("routes/home.tsx"),

  // API Routes
  route("api/paypal/orders", "routes/api.paypal.orders.ts"),
  route("api/paypal/webhook", "routes/api.paypal.webhook.ts"),
  route("api/calendar", "routes/api.calendar.ts"),
  route("api/valr", "routes/api.valr.ts"),
  route("api/fx", "routes/api.fx.ts"),
  route("auth/callback", "routes/auth.callback.ts"),

  // Booking result pages (optional - can show inline)
  route("booking/success", "routes/booking.success.tsx"),
  route("booking/cancel", "routes/booking.cancel.tsx"),

  // Legal
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),

  // Admin (owner-only)
  route("admin", "routes/admin.tsx"),
  route("admin/pricing", "routes/admin.pricing.tsx"),
  route("admin/login", "routes/admin.login.tsx"),
  route("admin/logout", "routes/admin.logout.tsx"),
] satisfies RouteConfig;
