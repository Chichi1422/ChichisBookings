// app/routes/booking.success.tsx
import { Link, useSearchParams } from 'react-router';

export function meta() {
  return [
    { title: "Booking Confirmed | Chi Chi's Beauty Spa" },
  ];
}

export default function BookingSuccess() {
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('transaction_id');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="font-playfair text-3xl mb-4">Payment Successful!</h1>
        <p className="text-white/60 mb-6">
          Your booking has been confirmed. We've sent the details to your phone via WhatsApp.
        </p>
        
        {transactionId && (
          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <p className="text-sm text-white/50">Transaction ID</p>
            <p className="font-mono text-[#f48fb1]">{transactionId}</p>
          </div>
        )}
        
        <div className="space-y-4">
          <Link
            to="/"
            className="block w-full py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all"
          >
            Return Home
          </Link>
          <a
            href="https://wa.me/27633923033"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 border border-white/20 text-white rounded-xl hover:bg-white/5 transition-all"
          >
            Contact Us on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}