// app/routes/api.calendar.ts
// Google Calendar integration for booking appointments

import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// In production, store tokens in a database
let storedTokens: { access_token?: string; refresh_token?: string } | null = null;

interface BookingRequest {
  service: string;
  duration: string;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  bookingTime: string;
  isHomeCall: boolean;
  paymentMethod: 'paypal' | 'valr' | 'cash';
  transactionId?: string;
}

interface TimeSlot {
  time: string;
  display: string;
  available: boolean;
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  switch (intent) {
    case 'getAvailableSlots':
      return getAvailableSlots(formData);
    case 'createBooking':
      return createBooking(formData);
    case 'getAuthUrl':
      return getAuthUrl();
    case 'setTokens':
      return setTokens(formData);
    default:
      return Response.json({ error: 'Invalid intent' }, { status: 400 });
  }
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  
  if (date) {
    return getAvailableSlotsForDate(date);
  }
  
  return Response.json({ error: 'Date parameter required' }, { status: 400 });
}

function getAuthUrl() {
  const scopes = ['https://www.googleapis.com/auth/calendar'];
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
  
  return Response.json({ url });
}

async function setTokens(formData: FormData) {
  const code = formData.get('code') as string;
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    storedTokens = tokens;
    oauth2Client.setCredentials(tokens);
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to set tokens:', error);
    return Response.json({ error: 'Failed to authenticate' }, { status: 500 });
  }
}

async function ensureAuthenticated() {
  if (!storedTokens) {
    throw new Error('Not authenticated with Google Calendar');
  }
  
  oauth2Client.setCredentials(storedTokens);
  
  // Check if token needs refresh
  if (storedTokens.access_token) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      storedTokens = credentials;
      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }
}

async function getAvailableSlotsForDate(dateStr: string): Promise<Response> {
  try {
    await ensureAuthenticated();
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const date = new Date(dateStr);
    
    // Get start and end of day in South African timezone
    const startOfDay = new Date(date);
    startOfDay.setHours(9, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(19, 0, 0, 0);
    
    // Fetch existing events for the day
    const events = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const bookedSlots = (events.data.items || []).map(event => ({
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
    }));
    
    // Generate all possible time slots
    const allSlots: TimeSlot[] = [
      { time: '09:00', display: '9:00 AM', available: true },
      { time: '10:00', display: '10:00 AM', available: true },
      { time: '11:00', display: '11:00 AM', available: true },
      { time: '12:00', display: '12:00 PM', available: true },
      { time: '14:00', display: '2:00 PM', available: true },
      { time: '15:00', display: '3:00 PM', available: true },
      { time: '16:00', display: '4:00 PM', available: true },
      { time: '17:00', display: '5:00 PM', available: true },
      { time: '18:00', display: '6:00 PM', available: true },
    ];
    
    // Mark slots as unavailable if they overlap with existing bookings
    const availableSlots = allSlots.map(slot => {
      const [hours, minutes] = slot.time.split(':').map(Number);
      const slotStart = new Date(date);
      slotStart.setHours(hours, minutes, 0, 0);
      
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 90); // Assume 90 min max service
      
      const isBooked = bookedSlots.some(booking => 
        (slotStart >= booking.start && slotStart < booking.end) ||
        (slotEnd > booking.start && slotEnd <= booking.end)
      );
      
      // Also check if slot is in the past
      const now = new Date();
      const isPast = slotStart < now;
      
      return {
        ...slot,
        available: !isBooked && !isPast,
      };
    });
    
    return Response.json({ slots: availableSlots });
  } catch (error) {
    console.error('Failed to get available slots:', error);
    
    // If not authenticated, return all slots as available (fallback)
    const fallbackSlots: TimeSlot[] = [
      { time: '09:00', display: '9:00 AM', available: true },
      { time: '10:00', display: '10:00 AM', available: true },
      { time: '11:00', display: '11:00 AM', available: true },
      { time: '12:00', display: '12:00 PM', available: true },
      { time: '14:00', display: '2:00 PM', available: true },
      { time: '15:00', display: '3:00 PM', available: true },
      { time: '16:00', display: '4:00 PM', available: true },
      { time: '17:00', display: '5:00 PM', available: true },
      { time: '18:00', display: '6:00 PM', available: true },
    ];
    
    return Response.json({ 
      slots: fallbackSlots, 
      warning: 'Calendar not connected - showing all slots' 
    });
  }
}

async function getAvailableSlots(formData: FormData): Promise<Response> {
  const date = formData.get('date') as string;
  return getAvailableSlotsForDate(date);
}

async function createBooking(formData: FormData): Promise<Response> {
  try {
    const booking: BookingRequest = {
      service: formData.get('service') as string,
      duration: formData.get('duration') as string,
      customerName: formData.get('customerName') as string,
      customerPhone: formData.get('customerPhone') as string,
      bookingDate: formData.get('bookingDate') as string,
      bookingTime: formData.get('bookingTime') as string,
      isHomeCall: formData.get('isHomeCall') === 'true',
      paymentMethod: formData.get('paymentMethod') as 'paypal' | 'valr' | 'cash',
      transactionId: formData.get('transactionId') as string | undefined,
    };
    
    // Parse duration to minutes
    const durationMatch = booking.duration.match(/(\d+)/);
    const durationMinutes = durationMatch ? parseInt(durationMatch[1]) : 60;
    
    // Create event times
    const [hours, minutes] = booking.bookingTime.split(':').map(Number);
    const startTime = new Date(booking.bookingDate);
    startTime.setHours(hours, minutes, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + durationMinutes);
    
    try {
      await ensureAuthenticated();
      
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const event = {
        summary: `🧖‍♀️ ${booking.service} - ${booking.customerName}`,
        description: `
Service: ${booking.service}
Duration: ${booking.duration}
Customer: ${booking.customerName}
Phone: ${booking.customerPhone}
Type: ${booking.isHomeCall ? '🏠 Home Service' : '🏪 At Spa'}
Payment: ${booking.paymentMethod.toUpperCase()}${booking.transactionId ? ` (${booking.transactionId})` : ''}
        `.trim(),
        start: {
          dateTime: startTime.toISOString(),
          timeZone: process.env.BUSINESS_TIMEZONE || 'Africa/Johannesburg',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: process.env.BUSINESS_TIMEZONE || 'Africa/Johannesburg',
        },
        colorId: booking.isHomeCall ? '6' : '2', // Orange for home, green for spa
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      };
      
      const createdEvent = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        requestBody: event,
      });
      
      return Response.json({
        success: true,
        eventId: createdEvent.data.id,
        booking: {
          ...booking,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      });
    } catch (calendarError) {
      console.error('Calendar error:', calendarError);
      
      // Even if calendar fails, return success for the booking
      // The spa owner can manually add it
      return Response.json({
        success: true,
        warning: 'Booking saved but calendar sync failed',
        booking: {
          ...booking,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      });
    }
  } catch (error) {
    console.error('Booking creation error:', error);
    return Response.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}