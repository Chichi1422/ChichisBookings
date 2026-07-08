// Server-only PayPal helpers shared by the checkout route and the admin
// confirm/decline flow. Never imported by client code.

export const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

export async function getPayPalAccessToken(): Promise<string> {
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

/**
 * Full refund of a captured payment. Self-contained (fetches its own token) so
 * callers don't need to manage PayPal auth. Empty body = full refund.
 */
export async function refundCapture(
  captureId: string,
): Promise<{ ok: boolean; refundId?: string; error?: string }> {
  try {
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/payments/captures/${captureId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error('[paypal] refund failed:', response.status, body);
      return { ok: false, error: `refund_failed_${response.status}` };
    }

    const data = await response.json();
    return { ok: true, refundId: data.id };
  } catch (err) {
    console.error('[paypal] refund error:', err);
    return { ok: false, error: 'refund_error' };
  }
}
