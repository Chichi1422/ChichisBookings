// app/routes/admin.tsx
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';

export function meta() {
  return [
    { title: "Admin | Chi Chi's Beauty Spa" },
  ];
}

export default function Admin() {
  const [searchParams] = useSearchParams();
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success === 'calendar_connected') {
      setMessage({ type: 'success', text: 'Google Calendar connected successfully!' });
      setCalendarConnected(true);
    } else if (error) {
      setMessage({ type: 'error', text: `Authentication failed: ${error}` });
    }
  }, [searchParams]);

  const connectCalendar = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('intent', 'getAuthUrl');
      
      const response = await fetch('/api/calendar', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: 'Failed to get authentication URL' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to connect to Google Calendar' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-playfair text-3xl">Admin Panel</h1>
          <Link to="/" className="text-[#f48fb1] hover:text-[#f8bbd9] transition-colors">
            ← Back to Site
          </Link>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl ${
            message.type === 'success' 
              ? 'bg-green-500/20 border border-green-500/50 text-green-300'
              : 'bg-red-500/20 border border-red-500/50 text-red-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* Google Calendar Connection */}
        <div className="gradient-border rounded-2xl p-6 mb-6">
          <h2 className="font-playfair text-xl mb-4">Google Calendar</h2>
          <p className="text-white/60 mb-4">
            Connect your Google Calendar to automatically sync bookings and manage availability.
          </p>
          
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${calendarConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-white/80">
              {calendarConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          
          <button
            onClick={connectCalendar}
            disabled={loading}
            className="mt-4 px-6 py-3 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all disabled:opacity-50"
          >
            {loading ? 'Connecting...' : calendarConnected ? 'Reconnect Calendar' : 'Connect Google Calendar'}
          </button>
        </div>

        {/* Payment Configuration Info */}
        <div className="gradient-border rounded-2xl p-6 mb-6">
          <h2 className="font-playfair text-xl mb-4">Payment Configuration</h2>
          <p className="text-white/60 mb-4">
            Configure your payment providers in the <code className="bg-white/10 px-2 py-1 rounded">.env</code> file:
          </p>
          
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="font-semibold text-[#f48fb1] mb-2">PayPal</h3>
              <ul className="text-sm text-white/60 space-y-1">
                <li>• PAYPAL_CLIENT_ID - Your PayPal client ID</li>
                <li>• PAYPAL_CLIENT_SECRET - Your PayPal secret</li>
                <li>• PAYPAL_MODE - sandbox or live</li>
              </ul>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="font-semibold text-[#f48fb1] mb-2">VALR Pay</h3>
              <ul className="text-sm text-white/60 space-y-1">
                <li>• VALR_API_KEY - Your VALR API key</li>
                <li>• VALR_API_SECRET - Your VALR API secret</li>
                <li>• VALR_PAY_ID - Your VALR Pay identifier</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="gradient-border rounded-2xl p-6">
          <h2 className="font-playfair text-xl mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 gap-4">
            <a
              href="https://developer.paypal.com/dashboard/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="font-semibold mb-1">PayPal Dashboard</div>
              <div className="text-sm text-white/50">Manage PayPal integration</div>
            </a>
            <a
              href="https://www.valr.com/settings/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="font-semibold mb-1">VALR API Keys</div>
              <div className="text-sm text-white/50">Manage VALR credentials</div>
            </a>
            <a
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="font-semibold mb-1">Google Cloud</div>
              <div className="text-sm text-white/50">Calendar API settings</div>
            </a>
            <a
              href="https://calendar.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="font-semibold mb-1">Google Calendar</div>
              <div className="text-sm text-white/50">View bookings</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}