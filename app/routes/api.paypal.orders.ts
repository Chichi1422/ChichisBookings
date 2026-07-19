// app/routes/api.paypal.orders.ts
// Server-side PayPal order management — driven by reservationId; never trusts
// client-supplied prices.

import { getReservation, markPaid } from '~/lib/bookings.server';
import { quoteAmount, type QuoteCurrency } from '~/lib/fx.server';
import { PAYPAL_API_BASE, getPayPalAccessToken, refundCapture } from '~/lib/paypal.server';
import { sendAlert } from '~/lib/alerts.server';

// Currencies PayPal can process for this account. ZAR is intentionally absent —
// PayPal does not support it, so ZAR bookings go through cash/VALR instead.
const SUPPORTED_PAYPAL_CURRENCIES: QuoteCurrency[] = ['USD', 'EUR'];

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'create') return createOrder(formData);
  if (intent === 'capture') return captureOrder(formData);
  return Response.json({ error: 'Invalid intent' }, { status: 400 });
}

async function createOrder(formData: FormData) {
  try {
    const reservationId = (formData.get('reservationId') as string) || '';
    if (!reservationId) {
      return Response.json({ error: 'reservation_required' }, { status: 400 });
    }

    const reservation = await getReservation(reservationId);
    if (!reservation) {
      return Response.json({ error: 'reservation_missing' }, { status: 404 });
    }
    if (reservation.status !== 'pending') {
      return Response.json({ error: 'reservation_not_pending' }, { status: 409 });
    }
    if (new Date(reservation.expires_at).getTime() <= Date.now()) {
      return Response.json({ error: 'reservation_expired' }, { status: 410 });
    }
    if (reservation.payment_method !== 'paypal') {
      return Response.json({ error: 'wrong_payment_method' }, { status: 400 });
    }
    if (!reservation.amount_zar) {
      return Response.json({ error: 'missing_amount' }, { status: 500 });
    }

    const currency = ((formData.get('currency') as string) || 'USD').toUpperCase() as QuoteCurrency;
    if (!SUPPORTED_PAYPAL_CURRENCIES.includes(currency)) {
      return Response.json({ error: 'unsupported_currency' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();
    // Server-side conversion from the authoritative ZAR price — never trust a
    // client-supplied amount, only the currency choice.
    const quote = await quoteAmount(Number(reservation.amount_zar), currency);
    const chargeAmount = quote.amount.toFixed(2);

    const order = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: currency, value: chargeAmount },
          description: `Chi Chi's Spa - ${reservation.service} (${reservation.duration})`,
          // custom_id is the only ground-truth payload we trust on capture.
          custom_id: reservationId,
        },
      ],
      application_context: {
        brand_name: "Chi Chi's Beauty Spa",
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.APP_URL}/booking/success`,
        cancel_url: `${process.env.APP_URL}/booking/cancel`,
      },
    };

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    });
    const data = await response.json();

    if (!response.ok) {
      console.error('PayPal order creation failed:', data);
      return Response.json({ error: 'Failed to create order' }, { status: 500 });
    }
    return Response.json({ orderID: data.id });
  } catch (error) {
    console.error('PayPal create order error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function captureOrder(formData: FormData) {
  try {
    const orderID = formData.get('orderID') as string;
    if (!orderID) return Response.json({ error: 'Order ID required' }, { status: 400 });

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const data = await response.json();

    if (!response.ok) {
      console.error('PayPal capture failed:', data);
      return Response.json({ error: 'Failed to capture payment' }, { status: 500 });
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId: string | undefined = capture?.id;
    const reservationId: string | undefined =
      capture?.custom_id || data.purchase_units?.[0]?.custom_id;

    if (!reservationId || !captureId) {
      console.error('PayPal capture missing reservationId/captureId:', data);
      return Response.json({ error: 'Capture missing reservation reference' }, { status: 500 });
    }

    // What PayPal actually captured, for the booking record.
    const paidCurrency: string | undefined = capture?.amount?.currency_code;
    const paidValue = capture?.amount?.value;
    const paidRecord =
      paidCurrency && paidValue != null
        ? { currency: paidCurrency, amount: Number(paidValue) }
        : undefined;

    // Atomic: only succeeds if still pending + unexpired.
    const paid = await markPaid(reservationId, captureId, paidRecord);
    if (!paid.ok) {
      // Before treating this as expired, check whether the capture WEBHOOK beat
      // us to markPaid with this same capture — that's a success, and refunding
      // it would claw back a valid payment.
      const current = await getReservation(reservationId);
      if (
        current &&
        (current.status === 'paid' || current.status === 'confirmed') &&
        current.payment_provider_ref === captureId
      ) {
        return Response.json({
          success: true,
          pendingConfirmation: true,
          transactionId: captureId,
          status: data.status,
        });
      }

      // Reservation expired / already used. Refund and tell the user.
      const refund = await refundCapture(captureId);
      if (!refund.ok) {
        console.error('PayPal refund after expired reservation failed:', refund.error);
        await sendAlert('PayPal refund FAILED — manual refund needed', [
          `A payment was captured for an expired reservation and the automatic refund failed.`,
          `Refund it manually in the PayPal dashboard.`,
          `Capture ID: ${captureId}`,
          `Reservation: ${reservationId}`,
          `Amount: ${paidCurrency ?? '?'} ${paidValue ?? '?'}`,
        ]);
      }
      return Response.json(
        { error: 'reservation_expired', refunded: refund.ok },
        { status: 410 },
      );
    }

    // Do NOT auto-confirm: the booking now waits at status='paid' for the owner
    // to confirm (creates the calendar event) or decline (refunds) in /admin.
    return Response.json({
      success: true,
      pendingConfirmation: true,
      transactionId: captureId,
      status: data.status,
    });
  } catch (error) {
    console.error('PayPal capture error:', error);
    // We may have crashed between PayPal capturing and the DB recording it —
    // money in limbo until the capture webhook reconciles. Tell the owner.
    await sendAlert('PayPal capture flow crashed — check PayPal dashboard', [
      `The capture flow threw before the booking could be updated.`,
      `Order ID: ${(formData.get('orderID') as string) || 'unknown'}`,
      `If a payment shows as captured in PayPal but no booking appears in`,
      `"Pending confirmation", the capture webhook should reconcile it shortly;`,
      `otherwise refund manually.`,
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    ]);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
