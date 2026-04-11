// app/routes/api.paypal.orders.ts
// Server-side PayPal order management

interface PayPalOrderRequest {
  service: string;
  duration: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  bookingTime: string;
  isHomeCall: boolean;
}

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
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

  if (intent === 'create') {
    return createOrder(formData);
  } else if (intent === 'capture') {
    return captureOrder(formData);
  }

  return Response.json({ error: 'Invalid intent' }, { status: 400 });
}

async function createOrder(formData: FormData) {
  try {
    const orderData: PayPalOrderRequest = {
      service: formData.get('service') as string,
      duration: formData.get('duration') as string,
      amount: parseFloat(formData.get('amount') as string),
      customerName: formData.get('customerName') as string,
      customerPhone: formData.get('customerPhone') as string,
      bookingDate: formData.get('bookingDate') as string,
      bookingTime: formData.get('bookingTime') as string,
      isHomeCall: formData.get('isHomeCall') === 'true',
    };

    const accessToken = await getPayPalAccessToken();

    // Convert ZAR to USD for PayPal (approximate, you'd want live rates)
    // For production, use a currency conversion API
    const zarToUsdRate = 0.053; // Example rate - fetch real rate in production
    const usdAmount = (orderData.amount * zarToUsdRate).toFixed(2);

    const order = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: usdAmount,
          },
          description: `Chi Chi's Spa - ${orderData.service} (${orderData.duration})`,
          custom_id: JSON.stringify({
            service: orderData.service,
            duration: orderData.duration,
            originalAmountZAR: orderData.amount,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            bookingDate: orderData.bookingDate,
            bookingTime: orderData.bookingTime,
            isHomeCall: orderData.isHomeCall,
          }),
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
        'Authorization': `Bearer ${accessToken}`,
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
    
    if (!orderID) {
      return Response.json({ error: 'Order ID required' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('PayPal capture failed:', data);
      return Response.json({ error: 'Failed to capture payment' }, { status: 500 });
    }

    // Extract booking details from custom_id
    const customId = data.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id 
      || data.purchase_units?.[0]?.custom_id;
    
    let bookingDetails = null;
    if (customId) {
      try {
        bookingDetails = JSON.parse(customId);
      } catch {
        console.error('Failed to parse custom_id');
      }
    }

    return Response.json({
      success: true,
      transactionId: data.purchase_units?.[0]?.payments?.captures?.[0]?.id,
      status: data.status,
      bookingDetails,
    });
  } catch (error) {
    console.error('PayPal capture error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}