// app/routes/api.valr.ts
// VALR Pay integration. Now driven by reservationId — amount and reference
// come from the DB row, not the client.

import crypto from 'crypto';
import { getReservation, markPaid } from '~/lib/bookings.server';

const VALR_API_BASE = 'https://api.valr.com';

function generateSignature(
  apiSecret: string,
  timestamp: string,
  verb: string,
  path: string,
  body = '',
): string {
  const payload = timestamp + verb.toUpperCase() + path + body;
  return crypto.createHmac('sha512', apiSecret).update(payload).digest('hex');
}

async function valrRequest(method: string, path: string, body?: object): Promise<any> {
  const apiKey = process.env.VALR_API_KEY;
  const apiSecret = process.env.VALR_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('VALR API credentials not configured');

  const timestamp = Date.now().toString();
  const bodyString = body ? JSON.stringify(body) : '';
  const signature = generateSignature(apiSecret, timestamp, method, path, bodyString);

  const response = await fetch(`${VALR_API_BASE}${path}`, {
    method,
    headers: {
      'X-VALR-API-KEY': apiKey,
      'X-VALR-SIGNATURE': signature,
      'X-VALR-TIMESTAMP': timestamp,
      'Content-Type': 'application/json',
    },
    body: bodyString || undefined,
  });
  return response.json();
}

function referenceFor(reservationId: string): string {
  return `CHI-${reservationId.slice(0, 8).toUpperCase()}`;
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  switch (intent) {
    case 'generatePaymentInfo':
      return generatePaymentInfo(formData);
    case 'checkPayment':
      return checkPayment(formData);
    case 'getExchangeRate':
      return getExchangeRate(formData);
    default:
      return Response.json({ error: 'Invalid intent' }, { status: 400 });
  }
}

async function generatePaymentInfo(formData: FormData): Promise<Response> {
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
    if (reservation.payment_method !== 'valr') {
      return Response.json({ error: 'wrong_payment_method' }, { status: 400 });
    }
    if (!reservation.amount_zar) {
      return Response.json({ error: 'missing_amount' }, { status: 500 });
    }

    const amount = Number(reservation.amount_zar);
    const valrPayId = process.env.VALR_PAY_ID;
    const reference = referenceFor(reservationId);

    let cryptoPrices = {};
    try {
      const [btc, eth, usdt] = await Promise.all([
        valrRequest('GET', '/v1/public/BTCZAR/marketsummary'),
        valrRequest('GET', '/v1/public/ETHZAR/marketsummary'),
        valrRequest('GET', '/v1/public/USDTZAR/marketsummary'),
      ]);
      cryptoPrices = {
        BTC: { price: btc.lastTradedPrice, amount: (amount / parseFloat(btc.lastTradedPrice)).toFixed(8) },
        ETH: { price: eth.lastTradedPrice, amount: (amount / parseFloat(eth.lastTradedPrice)).toFixed(8) },
        USDT: { price: usdt.lastTradedPrice, amount: (amount / parseFloat(usdt.lastTradedPrice)).toFixed(2) },
      };
    } catch (err) {
      console.error('Failed to fetch crypto prices:', err);
    }

    return Response.json({
      success: true,
      paymentInfo: {
        valrPayId,
        reference,
        amountZAR: amount,
        cryptoOptions: cryptoPrices,
        instructions: [
          '1. Open your VALR app',
          '2. Go to VALR Pay',
          '3. Scan the QR code or enter the VALR Pay ID',
          `4. Enter amount: R${amount.toFixed(2)}`,
          `5. Add reference: ${reference}`,
          '6. Complete the payment',
        ],
        deepLink: `valr://pay?amount=${amount}&currency=ZAR&reference=${reference}&recipient=${valrPayId}`,
        webLink: 'https://www.valr.com/pay',
        businessPhone: process.env.BUSINESS_PHONE,
      },
    });
  } catch (error) {
    console.error('VALR payment info error:', error);
    return Response.json({ error: 'Failed to generate payment info' }, { status: 500 });
  }
}

async function checkPayment(formData: FormData): Promise<Response> {
  try {
    const reservationId = (formData.get('reservationId') as string) || '';
    if (!reservationId) {
      return Response.json({ error: 'reservation_required', found: false }, { status: 400 });
    }

    const reservation = await getReservation(reservationId);
    if (!reservation || reservation.payment_method !== 'valr') {
      return Response.json({ error: 'reservation_missing', found: false }, { status: 404 });
    }
    if (reservation.status === 'confirmed') {
      return Response.json({
        found: true,
        alreadyConfirmed: true,
        booking: reservation,
      });
    }
    if (new Date(reservation.expires_at).getTime() <= Date.now() && reservation.status === 'pending') {
      return Response.json({ error: 'reservation_expired', found: false }, { status: 410 });
    }

    const expectedAmount = Number(reservation.amount_zar);
    const reference = referenceFor(reservationId);

    const transactions = await valrRequest(
      'GET',
      `/v1/account/transactionhistory?skip=0&limit=50&transactionTypes=PAYMENT_RECEIVED`,
    );

    const matching = (transactions ?? []).find((tx: any) => {
      const txAmount = parseFloat(tx.creditValue || tx.debitValue || '0');
      const txRef = tx.additionalInfo?.reference || tx.description || '';
      return txRef.includes(reference) && Math.abs(txAmount - expectedAmount) < 1;
    });

    if (!matching) {
      return Response.json({
        found: false,
        message: 'Payment not found yet. Please ensure you used the correct reference.',
      });
    }

    const paid = await markPaid(reservationId, matching.id, {
      currency: matching.currency || 'ZAR',
      amount: Number(matching.creditValue) || expectedAmount,
    });
    if (!paid.ok) {
      return Response.json(
        { error: paid.error, found: true },
        { status: paid.error === 'reservation_expired' ? 410 : 500 },
      );
    }

    // Do NOT auto-confirm: the booking waits at 'paid' for the owner to confirm
    // or decline in /admin.
    return Response.json({
      success: true,
      found: true,
      pendingConfirmation: true,
      payment: {
        id: matching.id,
        amount: matching.creditValue,
        currency: matching.currency,
        timestamp: matching.eventAt,
        status: 'paid',
      },
    });
  } catch (error) {
    console.error('VALR check payment error:', error);
    return Response.json({ error: 'Failed to check payment status', found: false }, { status: 500 });
  }
}

async function getExchangeRate(formData: FormData): Promise<Response> {
  try {
    const pair = (formData.get('pair') as string) || 'BTCZAR';
    const marketSummary = await valrRequest('GET', `/v1/public/${pair}/marketsummary`);
    return Response.json({
      pair,
      lastTradedPrice: marketSummary.lastTradedPrice,
      bidPrice: marketSummary.bidPrice,
      askPrice: marketSummary.askPrice,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('VALR exchange rate error:', error);
    return Response.json({ error: 'Failed to fetch exchange rate' }, { status: 500 });
  }
}
