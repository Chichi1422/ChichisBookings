// app/routes/api.valr.ts
// VALR Pay integration for crypto payments

import crypto from 'crypto';

const VALR_API_BASE = 'https://api.valr.com';

interface ValrPaymentRequest {
  amount: number;
  currency: string; // ZAR, BTC, ETH, USDT, etc.
  reference: string;
  customerName: string;
}

// Generate HMAC signature for VALR API authentication
function generateSignature(
  apiSecret: string,
  timestamp: string,
  verb: string,
  path: string,
  body: string = ''
): string {
  const payload = timestamp + verb.toUpperCase() + path + body;
  return crypto
    .createHmac('sha512', apiSecret)
    .update(payload)
    .digest('hex');
}

// Make authenticated request to VALR API
async function valrRequest(
  method: string,
  path: string,
  body?: object
): Promise<any> {
  const apiKey = process.env.VALR_API_KEY;
  const apiSecret = process.env.VALR_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    throw new Error('VALR API credentials not configured');
  }
  
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
    const payment: ValrPaymentRequest = {
      amount: parseFloat(formData.get('amount') as string),
      currency: (formData.get('currency') as string) || 'ZAR',
      reference: formData.get('reference') as string,
      customerName: formData.get('customerName') as string,
    };
    
    const valrPayId = process.env.VALR_PAY_ID;
    
    // Generate a unique payment reference
    const paymentRef = `CHICHI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // For VALR Pay, customers can pay via:
    // 1. VALR Pay ID (QR code)
    // 2. Phone number linked to VALR account
    // 3. Email linked to VALR account
    
    // Get current crypto prices to show alternatives
    let cryptoPrices = {};
    try {
      const btcPrice = await valrRequest('GET', '/v1/public/BTCZAR/marketsummary');
      const ethPrice = await valrRequest('GET', '/v1/public/ETHZAR/marketsummary');
      const usdtPrice = await valrRequest('GET', '/v1/public/USDTZAR/marketsummary');
      
      cryptoPrices = {
        BTC: {
          price: btcPrice.lastTradedPrice,
          amount: (payment.amount / parseFloat(btcPrice.lastTradedPrice)).toFixed(8),
        },
        ETH: {
          price: ethPrice.lastTradedPrice,
          amount: (payment.amount / parseFloat(ethPrice.lastTradedPrice)).toFixed(8),
        },
        USDT: {
          price: usdtPrice.lastTradedPrice,
          amount: (payment.amount / parseFloat(usdtPrice.lastTradedPrice)).toFixed(2),
        },
      };
    } catch (priceError) {
      console.error('Failed to fetch crypto prices:', priceError);
    }
    
    return Response.json({
      success: true,
      paymentInfo: {
        valrPayId,
        reference: paymentRef,
        amountZAR: payment.amount,
        cryptoOptions: cryptoPrices,
        instructions: [
          '1. Open your VALR app',
          '2. Go to VALR Pay',
          '3. Scan the QR code or enter the VALR Pay ID',
          `4. Enter amount: R${payment.amount.toFixed(2)}`,
          `5. Add reference: ${paymentRef}`,
          '6. Complete the payment',
        ],
        // Deep link to VALR app (if on mobile)
        deepLink: `valr://pay?amount=${payment.amount}&currency=ZAR&reference=${paymentRef}&recipient=${valrPayId}`,
        // Web link to VALR
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
    const reference = formData.get('reference') as string;
    const expectedAmount = parseFloat(formData.get('amount') as string);
    
    // Get recent transaction history to look for matching payment
    const transactions = await valrRequest(
      'GET',
      `/v1/account/transactionhistory?skip=0&limit=50&transactionTypes=PAYMENT_RECEIVED`
    );
    
    // Look for a matching payment in recent transactions
    const matchingPayment = transactions.find((tx: any) => {
      // Check if the reference matches and amount is correct
      const txAmount = parseFloat(tx.creditValue || tx.debitValue || '0');
      const txRef = tx.additionalInfo?.reference || tx.description || '';
      
      return txRef.includes(reference) && Math.abs(txAmount - expectedAmount) < 1; // 1 ZAR tolerance
    });
    
    if (matchingPayment) {
      return Response.json({
        found: true,
        payment: {
          id: matchingPayment.id,
          amount: matchingPayment.creditValue,
          currency: matchingPayment.currency,
          timestamp: matchingPayment.eventAt,
          status: 'confirmed',
        },
      });
    }
    
    return Response.json({
      found: false,
      message: 'Payment not found yet. Please ensure you used the correct reference.',
    });
  } catch (error) {
    console.error('VALR check payment error:', error);
    return Response.json({ 
      error: 'Failed to check payment status',
      found: false,
    }, { status: 500 });
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