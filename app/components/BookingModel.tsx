// app/components/BookingModal.tsx
// Enhanced booking modal with PayPal and VALR payment integration

import { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

interface Service {
  name: string;
  description: string;
  icon: string;
  options: { duration: string; price: number }[];
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedService: Service | null;
  selectedOption: { duration: string; price: number } | null;
  isHomeCall: boolean;
  homeCallFee: number;
}

type PaymentMethod = 'paypal' | 'valr' | 'cash';
type BookingStep = 'details' | 'payment' | 'processing' | 'confirmed';

interface ValrPaymentInfo {
  valrPayId: string;
  reference: string;
  amountZAR: number;
  cryptoOptions: {
    BTC?: { price: string; amount: string };
    ETH?: { price: string; amount: string };
    USDT?: { price: string; amount: string };
  };
  instructions: string[];
  deepLink: string;
  webLink: string;
  businessPhone: string;
}

export function BookingModal({
  isOpen,
  onClose,
  selectedService,
  selectedOption,
  isHomeCall,
  homeCallFee,
}: BookingModalProps) {
  const [step, setStep] = useState<BookingStep>('details');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('paypal');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<{ time: string; display: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [valrPaymentInfo, setValrPaymentInfo] = useState<ValrPaymentInfo | null>(null);
  const [checkingValrPayment, setCheckingValrPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPrice = selectedOption 
    ? selectedOption.price + (isHomeCall ? homeCallFee : 0) 
    : 0;

  // Fetch available time slots when date changes
  useEffect(() => {
    if (bookingDate) {
      fetchAvailableSlots(bookingDate);
    }
  }, [bookingDate]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('details');
      setPaymentMethod('paypal');
      setCustomerName('');
      setCustomerPhone('');
      setBookingDate('');
      setBookingTime('');
      setTransactionId(null);
      setValrPaymentInfo(null);
      setError(null);
    }
  }, [isOpen]);

  const fetchAvailableSlots = async (date: string) => {
    setLoadingSlots(true);
    try {
      const response = await fetch(`/api/calendar?date=${date}`);
      const data = await response.json();
      setAvailableSlots(data.slots || []);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      // Fallback to default slots
      setAvailableSlots([
        { time: '09:00', display: '9:00 AM', available: true },
        { time: '10:00', display: '10:00 AM', available: true },
        { time: '11:00', display: '11:00 AM', available: true },
        { time: '12:00', display: '12:00 PM', available: true },
        { time: '14:00', display: '2:00 PM', available: true },
        { time: '15:00', display: '3:00 PM', available: true },
        { time: '16:00', display: '4:00 PM', available: true },
        { time: '17:00', display: '5:00 PM', available: true },
        { time: '18:00', display: '6:00 PM', available: true },
      ]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const proceedToPayment = () => {
    if (!customerName || !customerPhone || !bookingDate || !bookingTime) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    setStep('payment');
  };

  const handlePayPalSuccess = async (transactionId: string) => {
    setTransactionId(transactionId);
    await createCalendarBooking(transactionId);
  };

  const initializeValrPayment = async () => {
    try {
      const formData = new FormData();
      formData.append('intent', 'generatePaymentInfo');
      formData.append('amount', totalPrice.toString());
      formData.append('currency', 'ZAR');
      formData.append('reference', `${selectedService?.name}-${customerName}`);
      formData.append('customerName', customerName);

      const response = await fetch('/api/valr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setValrPaymentInfo(data.paymentInfo);
      } else {
        setError('Failed to initialize VALR payment');
      }
    } catch (err) {
      console.error('VALR init error:', err);
      setError('Failed to initialize VALR payment');
    }
  };

  const checkValrPayment = async () => {
    if (!valrPaymentInfo) return;
    
    setCheckingValrPayment(true);
    try {
      const formData = new FormData();
      formData.append('intent', 'checkPayment');
      formData.append('reference', valrPaymentInfo.reference);
      formData.append('amount', totalPrice.toString());

      const response = await fetch('/api/valr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.found) {
        setTransactionId(data.payment.id);
        await createCalendarBooking(data.payment.id);
      } else {
        setError('Payment not found yet. Please ensure the payment was completed with the correct reference.');
      }
    } catch (err) {
      setError('Failed to verify payment');
    } finally {
      setCheckingValrPayment(false);
    }
  };

  const handleCashBooking = async () => {
    setStep('processing');
    await createCalendarBooking('CASH-PENDING');
  };

  const createCalendarBooking = async (txId: string) => {
    setStep('processing');
    try {
      const formData = new FormData();
      formData.append('intent', 'createBooking');
      formData.append('service', selectedService?.name || '');
      formData.append('duration', selectedOption?.duration || '');
      formData.append('customerName', customerName);
      formData.append('customerPhone', customerPhone);
      formData.append('bookingDate', bookingDate);
      formData.append('bookingTime', bookingTime);
      formData.append('isHomeCall', isHomeCall.toString());
      formData.append('paymentMethod', paymentMethod);
      formData.append('transactionId', txId);

      const response = await fetch('/api/calendar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setTransactionId(txId);
        setStep('confirmed');
      } else {
        setError('Booking created but calendar sync failed. We will contact you to confirm.');
        setStep('confirmed');
      }
    } catch (err) {
      setError('Failed to create booking. Please contact us directly.');
      setStep('confirmed');
    }
  };

  // Initialize VALR payment when selected
  useEffect(() => {
    if (step === 'payment' && paymentMethod === 'valr' && !valrPaymentInfo) {
      initializeValrPayment();
    }
  }, [step, paymentMethod]);

  if (!isOpen || !selectedService || !selectedOption) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="gradient-border rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-playfair text-2xl">
            {step === 'details' && 'Complete Your Booking'}
            {step === 'payment' && 'Payment'}
            {step === 'processing' && 'Processing...'}
            {step === 'confirmed' && 'Booking Confirmed!'}
          </h3>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Booking Summary */}
        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <p className="text-white/50 text-sm mb-1">Selected Treatment</p>
          <p className="font-semibold">{selectedService.name}</p>
          <p className="text-[#f48fb1]">
            {selectedOption.duration} • R{totalPrice} 
            {isHomeCall && <span className="text-white/40 text-sm ml-2">(incl. home service)</span>}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Step: Details */}
        {step === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Your Name</label>
              <input 
                type="text" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#f48fb1]/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Phone Number</label>
              <input 
                type="tel" 
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 063 123 4567"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#f48fb1]/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Preferred Date</label>
              <input 
                type="date" 
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#f48fb1]/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Preferred Time</label>
              {loadingSlots ? (
                <div className="text-white/40 text-sm">Loading available times...</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setBookingTime(slot.time)}
                      className={`py-2 rounded-lg border transition-all ${
                        bookingTime === slot.time 
                          ? 'bg-[#f48fb1] border-[#f48fb1] text-[#0a0a0a] font-semibold' 
                          : slot.available
                            ? 'border-white/10 hover:border-[#f48fb1]/50'
                            : 'border-white/5 text-white/30 cursor-not-allowed'
                      }`}
                    >
                      {slot.display}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={proceedToPayment}
              disabled={!customerName || !customerPhone || !bookingDate || !bookingTime}
              className="w-full py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              Continue to Payment
            </button>
          </div>
        )}

        {/* Step: Payment */}
        {step === 'payment' && (
          <div className="space-y-6">
            {/* Payment Method Selection */}
            <div>
              <label className="block text-sm text-white/60 mb-3">Payment Method</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setPaymentMethod('paypal')}
                  className={`p-4 rounded-xl border transition-all ${
                    paymentMethod === 'paypal'
                      ? 'border-[#f48fb1] bg-[#f48fb1]/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="text-2xl mb-1">💳</div>
                  <div className="text-sm font-medium">PayPal</div>
                  <div className="text-xs text-white/50">Card/PayPal</div>
                </button>
                <button
                  onClick={() => setPaymentMethod('valr')}
                  className={`p-4 rounded-xl border transition-all ${
                    paymentMethod === 'valr'
                      ? 'border-[#f48fb1] bg-[#f48fb1]/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="text-2xl mb-1">₿</div>
                  <div className="text-sm font-medium">Crypto</div>
                  <div className="text-xs text-white/50">VALR Pay</div>
                </button>
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-xl border transition-all ${
                    paymentMethod === 'cash'
                      ? 'border-[#f48fb1] bg-[#f48fb1]/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="text-2xl mb-1">💵</div>
                  <div className="text-sm font-medium">Cash</div>
                  <div className="text-xs text-white/50">Pay Later</div>
                </button>
              </div>
            </div>

            {/* PayPal Payment */}
            {paymentMethod === 'paypal' && (
              <PayPalScriptProvider options={{ 
                clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test',
                currency: 'USD',
              }}>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-sm text-white/60 mb-4">
                    Pay securely with PayPal or credit/debit card
                  </p>
                  <PayPalButtons
                    style={{ layout: 'vertical', color: 'gold', shape: 'rect' }}
                    createOrder={async () => {
                      const formData = new FormData();
                      formData.append('intent', 'create');
                      formData.append('service', selectedService?.name || '');
                      formData.append('duration', selectedOption?.duration || '');
                      formData.append('amount', totalPrice.toString());
                      formData.append('customerName', customerName);
                      formData.append('customerPhone', customerPhone);
                      formData.append('bookingDate', bookingDate);
                      formData.append('bookingTime', bookingTime);
                      formData.append('isHomeCall', isHomeCall.toString());

                      const response = await fetch('/api/paypal/orders', {
                        method: 'POST',
                        body: formData,
                      });
                      const data = await response.json();
                      return data.orderID;
                    }}
                    onApprove={async (data) => {
                      const formData = new FormData();
                      formData.append('intent', 'capture');
                      formData.append('orderID', data.orderID);

                      const response = await fetch('/api/paypal/orders', {
                        method: 'POST',
                        body: formData,
                      });
                      const result = await response.json();
                      
                      if (result.success) {
                        handlePayPalSuccess(result.transactionId);
                      } else {
                        setError('Payment capture failed. Please try again.');
                      }
                    }}
                    onError={(err) => {
                      console.error('PayPal error:', err);
                      setError('Payment failed. Please try again.');
                    }}
                  />
                </div>
              </PayPalScriptProvider>
            )}

            {/* VALR Payment */}
            {paymentMethod === 'valr' && (
              <div className="bg-white/5 rounded-xl p-4">
                {!valrPaymentInfo ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-8 h-8 border-2 border-[#f48fb1] border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-white/60">Generating payment details...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-white/60">
                      Pay with VALR Pay using ZAR or cryptocurrency
                    </p>
                    
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="text-center mb-4">
                        <p className="text-sm text-white/50">Amount Due</p>
                        <p className="text-3xl font-bold text-[#f48fb1]">R{totalPrice.toFixed(2)}</p>
                      </div>
                      
                      {valrPaymentInfo.cryptoOptions.BTC && (
                        <div className="text-sm text-white/60 text-center mb-4">
                          or ≈ {valrPaymentInfo.cryptoOptions.BTC.amount} BTC
                          {valrPaymentInfo.cryptoOptions.ETH && ` / ${valrPaymentInfo.cryptoOptions.ETH.amount} ETH`}
                        </div>
                      )}
                      
                      <div className="bg-[#0a0a0a] rounded-lg p-3 mb-4">
                        <p className="text-xs text-white/50 mb-1">Payment Reference (required)</p>
                        <p className="font-mono text-sm text-[#f48fb1] break-all">{valrPaymentInfo.reference}</p>
                      </div>
                      
                      <div className="space-y-2">
                        {valrPaymentInfo.instructions.map((instruction, i) => (
                          <p key={i} className="text-xs text-white/60">{instruction}</p>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <a
                        href={valrPaymentInfo.deepLink}
                        className="flex-1 py-3 bg-[#00d4aa] text-[#0a0a0a] font-semibold rounded-xl text-center hover:bg-[#00e4ba] transition-colors"
                      >
                        Open VALR App
                      </a>
                      <a
                        href={valrPaymentInfo.webLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 border border-white/20 text-white rounded-xl text-center hover:bg-white/5 transition-colors"
                      >
                        Pay on Web
                      </a>
                    </div>
                    
                    <button
                      onClick={checkValrPayment}
                      disabled={checkingValrPayment}
                      className="w-full py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all disabled:opacity-50"
                    >
                      {checkingValrPayment ? 'Checking...' : "I've Made the Payment"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Cash Payment */}
            {paymentMethod === 'cash' && (
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-sm text-white/60 mb-4">
                  Reserve your appointment now and pay in cash when you arrive.
                </p>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ Please arrive 10 minutes early to complete payment before your appointment.
                  </p>
                </div>
                <button
                  onClick={handleCashBooking}
                  className="w-full py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all"
                >
                  Reserve Appointment
                </button>
              </div>
            )}

            <button
              onClick={() => setStep('details')}
              className="w-full py-3 border border-white/20 text-white rounded-xl hover:bg-white/5 transition-all"
            >
              ← Back to Details
            </button>
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-[#f48fb1] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-white/60">Creating your booking...</p>
          </div>
        )}

        {/* Step: Confirmed */}
        {step === 'confirmed' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#f48fb1]/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-[#f48fb1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-playfair text-2xl mb-2">Booking Confirmed!</h3>
            <p className="text-white/60 mb-4">
              {paymentMethod === 'cash' 
                ? "We'll see you soon! Please remember to bring cash."
                : "Thank you for your payment. We'll see you soon!"}
            </p>
            <div className="bg-white/5 rounded-xl p-4 text-left mb-6">
              <p className="text-sm"><span className="text-white/50">Date:</span> {bookingDate}</p>
              <p className="text-sm"><span className="text-white/50">Time:</span> {bookingTime}</p>
              <p className="text-sm"><span className="text-white/50">Service:</span> {selectedService?.name}</p>
              {transactionId && transactionId !== 'CASH-PENDING' && (
                <p className="text-sm"><span className="text-white/50">Transaction:</span> {transactionId}</p>
              )}
            </div>
            <p className="text-white/40 text-sm mb-4">
              You'll receive a confirmation via WhatsApp
            </p>
            <button
              onClick={onClose}
              className="w-full py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}