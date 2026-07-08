// app/routes/api.fx.ts
// Live currency quote for the booking UI. Given a live reservation and a target
// currency, returns the amount that will actually be charged — computed from the
// authoritative ZAR price via the FX layer (never from a client-supplied amount).

import type { LoaderFunctionArgs } from 'react-router';
import { getReservation } from '~/lib/bookings.server';
import { quoteAmount, type Currency } from '~/lib/fx.server';

const CURRENCIES: Currency[] = ['ZAR', 'USD', 'EUR'];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const reservationId = url.searchParams.get('reservationId') || '';
  const currency = (url.searchParams.get('currency') || 'USD').toUpperCase() as Currency;

  if (!CURRENCIES.includes(currency)) {
    return Response.json({ error: 'unsupported_currency' }, { status: 400 });
  }

  const reservation = await getReservation(reservationId);
  if (!reservation || reservation.amount_zar == null) {
    return Response.json({ error: 'reservation_missing' }, { status: 404 });
  }

  const quote = await quoteAmount(Number(reservation.amount_zar), currency);
  return Response.json({
    currency: quote.currency,
    amount: quote.amount,
    baseZar: quote.baseZar,
  });
}
