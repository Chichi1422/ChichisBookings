// app/routes/api.paypal.webhook.ts
// PayPal webhook reconciliation. The browser-driven capture flow is the primary
// path; this webhook is the safety net for the crash window where PayPal
// captured money but the server died before markPaid recorded it. PayPal
// retries webhook delivery for ~3 days, so even a full outage reconciles.
//
// Register in the PayPal dashboard: webhook URL {APP_URL}/api/paypal/webhook,
// event PAYMENT.CAPTURE.COMPLETED, then set PAYPAL_WEBHOOK_ID.

import { getReservation, markPaid } from '~/lib/bookings.server';
import { PAYPAL_API_BASE, getPayPalAccessToken, refundCapture } from '~/lib/paypal.server';
import { sendAlert } from '~/lib/alerts.server';

export async function action({ request }: { request: Request }) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    // Not configured — refuse loudly so a misconfigured deploy is visible in
    // PayPal's delivery logs (it will retry, which is what we want).
    console.error('[paypal.webhook] PAYPAL_WEBHOOK_ID not set');
    return Response.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  let event: any;
  try {
    event = await request.json();
  } catch {
    return Response.json({ error: 'bad_json' }, { status: 400 });
  }

  const verified = await verifySignature(request.headers, event, webhookId);
  if (!verified) {
    console.error('[paypal.webhook] signature verification failed');
    return Response.json({ error: 'bad_signature' }, { status: 401 });
  }

  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    await reconcileCapture(event.resource);
  }
  // 200 for everything verified — non-2xx would make PayPal retry events we
  // deliberately don't handle.
  return Response.json({ ok: true });
}

/**
 * Asks PayPal to verify the transmission signature so forged requests can't
 * mark bookings paid or trigger refunds.
 */
async function verifySignature(
  headers: Headers,
  event: unknown,
  webhookId: string,
): Promise<boolean> {
  try {
    const accessToken = await getPayPalAccessToken();
    const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transmission_id: headers.get('paypal-transmission-id'),
        transmission_time: headers.get('paypal-transmission-time'),
        cert_url: headers.get('paypal-cert-url'),
        auth_algo: headers.get('paypal-auth-algo'),
        transmission_sig: headers.get('paypal-transmission-sig'),
        webhook_id: webhookId,
        webhook_event: event,
      }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('[paypal.webhook] verify error:', err);
    return false;
  }
}

async function reconcileCapture(resource: any): Promise<void> {
  const captureId: string | undefined = resource?.id;
  const reservationId: string | undefined = resource?.custom_id;
  const currency: string | undefined = resource?.amount?.currency_code;
  const value: string | undefined = resource?.amount?.value;

  if (!captureId) return;
  if (!reservationId) {
    // Not from our checkout (no custom_id) — e.g. a manual PayPal transaction.
    console.warn('[paypal.webhook] capture without custom_id, ignoring:', captureId);
    return;
  }

  const reservation = await getReservation(reservationId);
  if (!reservation) {
    await sendAlert('PayPal capture references unknown booking', [
      `A capture completed for a reservation id that does not exist in the DB.`,
      `Capture ID: ${captureId}`,
      `Claimed reservation: ${reservationId}`,
      `Amount: ${currency ?? '?'} ${value ?? '?'}`,
      `Investigate in the PayPal dashboard before refunding.`,
    ]);
    return;
  }

  // Normal case: the browser capture flow already recorded this capture.
  if (
    (reservation.status === 'paid' || reservation.status === 'confirmed') &&
    reservation.payment_provider_ref === captureId
  ) {
    return;
  }

  // Declined-and-refunded (or being refunded) by the admin flow — nothing to do.
  if (reservation.status === 'declined' && reservation.payment_provider_ref === captureId) {
    return;
  }

  if (reservation.status === 'pending') {
    // The crash window: money captured, DB never updated. Record it now
    // (markPaid still enforces the not-expired rule atomically).
    const paid = await markPaid(reservationId, captureId, {
      currency: currency ?? 'USD',
      amount: Number(value) || 0,
    });
    if (paid.ok) {
      await sendAlert('Booking recovered via PayPal webhook', [
        `A payment was captured but the checkout flow never recorded it — the`,
        `webhook has now marked it paid. It is in "Pending confirmation" as normal.`,
        `Customer: ${reservation.customer_name} (${reservation.customer_phone})`,
        `Booking: ${reservation.service}, ${reservation.booking_date} ${reservation.booking_time}`,
      ]);
      return;
    }
    // Expired in the meantime — fall through to refund.
  }

  // Any other state (expired/cancelled, or paid under a different capture id):
  // this capture bought nothing. Refund it.
  const refund = await refundCapture(captureId);
  await sendAlert(
    refund.ok
      ? 'Orphaned PayPal capture auto-refunded'
      : 'Orphaned PayPal capture — refund FAILED, refund manually',
    [
      `A capture completed for a booking in state "${reservation.status}" that it`,
      `did not pay for. ${refund.ok ? 'It was refunded automatically.' : 'The automatic refund failed — refund it in the PayPal dashboard.'}`,
      `Capture ID: ${captureId}`,
      `Reservation: ${reservationId} (${reservation.customer_name})`,
      `Amount: ${currency ?? '?'} ${value ?? '?'}`,
    ],
  );
}
