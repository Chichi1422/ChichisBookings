// app/routes/booking.cancel.tsx
import { Link } from 'react-router';

export function meta() {
  return [
    { title: "Payment Cancelled | Chi Chi's Beauty Spa" },
  ];
}

export default function BookingCancel() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <svg className="w-12 h-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h1 className="font-playfair text-3xl mb-4">Payment Cancelled</h1>
        <p className="text-white/60 mb-6">
          Your payment was cancelled. No charges have been made to your account.
        </p>
        
        <div className="space-y-4">
          <Link
            to="/"
            className="block w-full py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all"
          >
            Try Again
          </Link>
          <a
            href="https://wa.me/27633923033"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 border border-white/20 text-white rounded-xl hover:bg-white/5 transition-all"
          >
            Need Help? Contact Us
          </a>
        </div>
      </div>
    </div>
  );
}