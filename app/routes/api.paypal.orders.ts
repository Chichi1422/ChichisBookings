// app/routes/api.paypal.orders.ts
// Server-side PayPal order management — driven by reservationId; never trusts
// client-supplied prices.

import { getReservation, markPaid } from '~/lib/bookings.server';
import { confirmReservationOnCalendar } from '~/lib/calendar.server';

const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

// ZAR → USD conversion. Hardcoded for now; tracked as a TODO in
// References.md to swap for a live FX feed.
const ZAR_TO_USD_RATE = 0.053;

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

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

    const accessToken = await getPayPalAccessToken();
    const usdAmount = (Number(reservation.amount_zar) * ZAR_TO_USD_RATE).toFixed(2);

    const order = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: usdAmount },
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

    // Atomic: only succeeds if still pending + unexpired.
    const paid = await markPaid(reservationId, captureId);
    if (!paid.ok) {
      // Reservation expired / already used. Refund and tell the user.
      await refundCapture(captureId, accessToken).catch((err) =>
        console.error('PayPal refund after expired reservation failed:', err),
      );
      return Response.json(
        { error: 'reservation_expired', refunded: true },
        { status: 410 },
      );
    }

    const confirmation = await confirmReservationOnCalendar(reservationId);
    return Response.json(
      {
        ...confirmation.responseBody,
        transactionId: captureId,
        status: data.status,
      },
      { status: confirmation.status },
    );
  } catch (error) {
    console.error('PayPal capture error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function refundCapture(captureId: string, accessToken: string): Promise<void> {
  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/payments/captures/${captureId}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}', // empty body = full refund
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal refund failed: ${response.status} ${body}`);
  }
}
