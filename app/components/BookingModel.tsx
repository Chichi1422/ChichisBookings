// app/components/BookingModal.tsx
// Booking modal. Slot is reserved server-side BEFORE the payment step opens —
// if the reservation 409s the user never sees a payment UI for an unavailable slot.

import { useState, useEffect, useRef } from 'react';
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

interface Reservation {
  reservationId: string;
  expiresAt: string;
  amountZar: number;
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
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [reserving, setReserving] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  // PayPal can't process ZAR, so card payments are charged in USD or EUR,
  // converted server-side from the ZAR base price.
  const [payCurrency, setPayCurrency] = useState<'USD' | 'EUR'>('USD');
  const [quote, setQuote] = useState<{ currency: string; amount: number } | null>(null);

  const totalPrice = selectedOption
    ? selectedOption.price + (isHomeCall ? homeCallFee : 0)
    : 0;

  const reservationRef = useRef<Reservation | null>(null);
  reservationRef.current = reservation;

  // Fetch available time slots when date changes.
  useEffect(() => {
    if (bookingDate) fetchAvailableSlots(bookingDate);
  }, [bookingDate]);

  // Reset state when modal opens.
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
      setReservation(null);
      setSecondsLeft(0);
      setPayCurrency('USD');
      setQuote(null);
    }
  }, [isOpen]);

  // Release the reservation if the user closes the modal mid-flow.
  useEffect(() => {
    if (!isOpen && reservationRef.current && step !== 'confirmed') {
      releaseReservation(reservationRef.current.reservationId);
    }
  }, [isOpen]);

  // Countdown ticker for the active reservation.
  useEffect(() => {
    if (!reservation) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const ms = new Date(reservation.expiresAt).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [reservation]);

  // When the reservation actually expires, surface an error and bounce back
  // to details. We check `expiresAt` directly instead of `secondsLeft` — the
  // ticker that updates `secondsLeft` runs in a separate effect, and on the
  // first render after `proceedToPayment` the displayed `secondsLeft` is
  // still its initial 0 from useState. Relying on that would (and did) fire
  // a bogus "expired" the instant the payment step opened.
  useEffect(() => {
    if (!reservation || step !== 'payment') return;
    if (new Date(reservation.expiresAt).getTime() > Date.now()) return;
    setError('Your reservation expired. Please pick a time again.');
    setReservation(null);
    setStep('details');
    if (bookingDate) fetchAvailableSlots(bookingDate);
  }, [secondsLeft, reservation, step, bookingDate]);

  const fetchAvailableSlots = async (date: string) => {
    setLoadingSlots(true);
    try {
      const response = await fetch(`/api/calendar?date=${date}`);
      const data = await response.json();
      setAvailableSlots(data.slots || []);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
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

  const releaseReservation = async (reservationId: string) => {
    try {
      const formData = new FormData();
      formData.append('intent', 'releaseReservation');
      formData.append('reservationId', reservationId);
      await fetch('/api/calendar', { method: 'POST', body: formData });
    } catch {
      // Best-effort. The TTL will clean it up server-side.
    }
  };

  const proceedToPayment = async () => {
    if (!customerName || !customerPhone || !bookingDate || !bookingTime) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    setReserving(true);
    try {
      const formData = new FormData();
      formData.append('intent', 'reserveSlot');
      formData.append('service', selectedService?.name || '');
      formData.append('duration', selectedOption?.duration || '');
      formData.append('customerName', customerName);
      formData.append('customerPhone', customerPhone);
      formData.append('bookingDate', bookingDate);
      formData.append('bookingTime', bookingTime);
      formData.append('isHomeCall', isHomeCall.toString());
      formData.append('paymentMethod', paymentMethod);

      const response = await fetch('/api/calendar', { method: 'POST', body: formData });
      const data = await response.json();

      if (response.status === 409) {
        setError('Sorry — that time was just taken. Please pick another.');
        await fetchAvailableSlots(bookingDate);
        setBookingTime('');
        return;
      }
      if (!response.ok) {
        setError(data.error === 'invalid_service' ? 'Service not recognised.' : 'Could not reserve that slot.');
        return;
      }

      setReservation({
        reservationId: data.reservationId,
        expiresAt: data.expiresAt,
        amountZar: data.amountZar,
      });
      setStep('payment');
    } catch (err) {
      console.error('reserveSlot failed:', err);
      setError('Could not reserve that slot. Please try again.');
    } finally {
      setReserving(false);
    }
  };

  // If the user changes payment method on the payment screen, the new method
  // affects TTL/reference, so we cancel the existing reservation and re-reserve.
  const switchPaymentMethod = async (method: PaymentMethod) => {
    if (method === paymentMethod) return;
    setPaymentMethod(method);
    if (reservation) {
      await releaseReservation(reservation.reservationId);
      setReservation(null);
      setValrPaymentInfo(null);
    }
    // Re-reserve in the new mode. proceedToPayment reads paymentMethod from state,
    // but state updates are batched — pass through a microtask so the new value sticks.
    queueMicrotask(() => {
      void rereserveWithMethod(method);
    });
  };

  const rereserveWithMethod = async (method: PaymentMethod) => {
    setError(null);
    setReserving(true);
    try {
      const formData = new FormData();
      formData.append('intent', 'reserveSlot');
      formData.append('service', selectedService?.name || '');
      formData.append('duration', selectedOption?.duration || '');
      formData.append('customerName', customerName);
      formData.append('customerPhone', customerPhone);
      formData.append('bookingDate', bookingDate);
      formData.append('bookingTime', bookingTime);
      formData.append('isHomeCall', isHomeCall.toString());
      formData.append('paymentMethod', method);

      const response = await fetch('/api/calendar', { method: 'POST', body: formData });
      const data = await response.json();
      if (response.status === 409) {
        setError('Sorry — that time was just taken. Please pick another.');
        setStep('details');
        await fetchAvailableSlots(bookingDate);
        setBookingTime('');
        return;
      }
      if (!response.ok) {
        setError('Could not reserve that slot.');
        setStep('details');
        return;
      }
      setReservation({
        reservationId: data.reservationId,
        expiresAt: data.expiresAt,
        amountZar: data.amountZar,
      });
    } finally {
      setReserving(false);
    }
  };

  const initializeValrPayment = async () => {
    if (!reservation) return;
    try {
      const formData = new FormData();
      formData.append('intent', 'generatePaymentInfo');
      formData.append('reservationId', reservation.reservationId);

      const response = await fetch('/api/valr', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.success) setValrPaymentInfo(data.paymentInfo);
      else setError('Failed to initialize VALR payment');
    } catch (err) {
      console.error('VALR init error:', err);
      setError('Failed to initialize VALR payment');
    }
  };

  const checkValrPayment = async () => {
    if (!valrPaymentInfo || !reservation) return;
    setCheckingValrPayment(true);
    try {
      const formData = new FormData();
      formData.append('intent', 'checkPayment');
      formData.append('reservationId', reservation.reservationId);

      const response = await fetch('/api/valr', { method: 'POST', body: formData });
      const data = await response.json();
      if (response.status === 410) {
        setError('Your reservation expired before we saw the payment. If you paid, contact us via WhatsApp.');
        return;
      }
      if (data.found) {
        setTransactionId(data.payment?.id ?? null);
        setStep(data.success ? 'confirmed' : 'processing');
        if (!data.success) setError('Payment received but calendar sync is pending. We will confirm shortly.');
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
    if (!reservation) return;
    setStep('processing');
    try {
      const formData = new FormData();
      formData.append('intent', 'confirmCashBooking');
      formData.append('reservationId', reservation.reservationId);
      const response = await fetch('/api/calendar', { method: 'POST', body: formData });
      const data = await response.json();
      if (response.status === 410) {
        setError('Your reservation expired. Please try again.');
        setStep('details');
        return;
      }
      if (data.success) {
        setTransactionId('CASH-PENDING');
        setStep('confirmed');
        if (data.warning) {
          setError('Booking saved — calendar sync will follow.');
        }
      } else {
        setError('Could not confirm cash booking. Please contact us directly.');
        setStep('payment');
      }
    } catch {
      setError('Could not confirm cash booking. Please contact us directly.');
      setStep('payment');
    }
  };

  const handlePayPalSuccess = (txId: string) => {
    setTransactionId(txId);
    setStep('confirmed');
  };

  // Trigger VALR init when entering the VALR payment screen.
  useEffect(() => {
    if (step === 'payment' && paymentMethod === 'valr' && !valrPaymentInfo && reservation) {
      void initializeValrPayment();
    }
  }, [step, paymentMethod, reservation]);

  // Fetch the live converted amount whenever the PayPal currency changes.
  useEffect(() => {
    if (step !== 'payment' || paymentMethod !== 'paypal' || !reservation) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/fx?reservationId=${encodeURIComponent(reservation.reservationId)}&currency=${payCurrency}`,
        );
        const data = await res.json();
        if (!cancelled && res.ok) setQuote({ currency: data.currency, amount: data.amount });
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, paymentMethod, reservation, payCurrency]);

  if (!isOpen || !selectedService || !selectedOption) return null;

  const minutesLeft = Math.floor(secondsLeft / 60);
  const remainderSecs = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="gradient-border rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-playfair text-2xl">
            {step === 'details' && 'Complete Your Booking'}
            {step === 'payment' && 'Payment'}
            {step === 'processing' && 'Processing...'}
            {step === 'confirmed' && 'Booking Requested'}
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

        {/* Reservation countdown */}
        {step === 'payment' && reservation && (
          <div className="bg-[#f48fb1]/10 border border-[#f48fb1]/30 rounded-xl p-3 mb-4 text-center">
            <p className="text-sm text-[#f48fb1]">
              Slot held for {minutesLeft}:{String(remainderSecs).padStart(2, '0')} — finish payment to confirm.
            </p>
          </div>
        )}

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
              <label className="block text-sm text-white/60 mb-2">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('paypal')}
                  className={`p-3 rounded-xl border transition-all ${
                    paymentMethod === 'paypal'
                      ? 'border-[#f48fb1] bg-[#f48fb1]/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="text-xl mb-1">💳</div>
                  <div className="text-sm font-medium">PayPal</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-xl border transition-all ${
                    paymentMethod === 'cash'
                      ? 'border-[#f48fb1] bg-[#f48fb1]/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="text-xl mb-1">💵</div>
                  <div className="text-sm font-medium">Cash</div>
                </button>
              </div>
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
              disabled={!customerName || !customerPhone || !bookingDate || !bookingTime || reserving}
              className="w-full py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {reserving ? 'Holding your slot…' : 'Continue to Payment'}
            </button>
          </div>
        )}

        {/* Step: Payment */}
        {step === 'payment' && (
          <div className="space-y-6">
            {/* Method switcher (lets user change PayPal ↔ Cash without losing the slot — re-reserves under the hood) */}
            <div>
              <label className="block text-sm text-white/60 mb-3">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => switchPaymentMethod('paypal')}
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
                  onClick={() => switchPaymentMethod('cash')}
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
            {paymentMethod === 'paypal' && reservation && (
              <PayPalScriptProvider
                key={payCurrency}
                options={{
                  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test',
                  currency: payCurrency,
                }}
              >
                <div className="bg-white/5 rounded-xl p-4">
                  {/* Currency selector — PayPal cannot process ZAR, so card
                      payments settle in USD or EUR. */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-white/60">Pay in</span>
                    <div className="flex gap-2">
                      {(['USD', 'EUR'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setPayCurrency(c)}
                          className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                            payCurrency === c
                              ? 'border-[#f48fb1] bg-[#f48fb1]/10 text-[#f48fb1]'
                              : 'border-white/10 text-white/60 hover:border-white/30'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mb-4">
                    {quote
                      ? `You'll pay ≈ ${quote.currency} ${quote.amount.toFixed(2)} (R${reservation.amountZar})`
                      : `Converting R${reservation.amountZar}…`}
                  </p>
                  <PayPalButtons
                    forceReRender={[payCurrency, quote?.amount]}
                    style={{ layout: 'vertical', color: 'gold', shape: 'rect' }}
                    createOrder={async () => {
                      const formData = new FormData();
                      formData.append('intent', 'create');
                      formData.append('reservationId', reservation.reservationId);
                      formData.append('currency', payCurrency);

                      const response = await fetch('/api/paypal/orders', {
                        method: 'POST',
                        body: formData,
                      });
                      const data = await response.json();
                      if (!response.ok) throw new Error(data.error || 'create_order_failed');
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

                      if (response.status === 410) {
                        setError(
                          result.refunded
                            ? 'Your reservation expired and the payment was refunded. Please book again.'
                            : 'Your reservation expired. Please book again.',
                        );
                        setStep('details');
                        await fetchAvailableSlots(bookingDate);
                        setBookingTime('');
                        return;
                      }
                      if (!response.ok || !result.success) {
                        setError('Payment capture failed. Please try again.');
                        return;
                      }
                      handlePayPalSuccess(result.transactionId);
                    }}
                    onError={(err) => {
                      console.error('PayPal error:', err);
                      setError('Payment failed. Please try again.');
                    }}
                  />
                </div>
              </PayPalScriptProvider>
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
                  disabled={!reservation || reserving}
                  className="w-full py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all disabled:opacity-50"
                >
                  Reserve Appointment
                </button>
              </div>
            )}

            <button
              onClick={async () => {
                if (reservation) await releaseReservation(reservation.reservationId);
                setReservation(null);
                setStep('details');
              }}
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
            <h3 className="font-playfair text-2xl mb-2">Booking Requested</h3>
            <p className="text-white/60 mb-4">
              {paymentMethod === 'cash'
                ? "Thanks! Your booking is pending confirmation — we'll confirm via WhatsApp shortly. Please remember to bring cash."
                : "Payment received. Your booking is pending confirmation — we'll confirm via WhatsApp shortly. If we can't accommodate your time, you'll be fully refunded."}
            </p>
            <div className="bg-white/5 rounded-xl p-4 text-left mb-6">
              <p className="text-sm">
                <span className="text-white/50">Date:</span> {bookingDate}
              </p>
              <p className="text-sm">
                <span className="text-white/50">Time:</span> {bookingTime}
              </p>
              <p className="text-sm">
                <span className="text-white/50">Service:</span> {selectedService?.name}
              </p>
              {transactionId && transactionId !== 'CASH-PENDING' && (
                <p className="text-sm">
                  <span className="text-white/50">Transaction:</span> {transactionId}
                </p>
              )}
            </div>
            <p className="text-white/40 text-sm mb-4">You'll receive a confirmation via WhatsApp</p>
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
