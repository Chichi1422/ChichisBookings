// Click-to-send WhatsApp helpers. Pure (no server deps) so the admin UI can
// build wa.me links the owner taps to message a customer after confirm/decline.
// There is no automated send yet — this just pre-fills the message.
//
// Messages are deliberately plain text: the wa.me → WhatsApp handoff mangles
// emoji into "?" on some platforms (observed on Windows desktop), so no emoji
// in anything we pre-fill.

interface BookingLike {
  customer_name: string;
  customer_phone: string;
  service: string;
  duration: string;
  booking_date: string;
  booking_time: string;
  is_home_call: boolean;
  payment_method: string;
  amount_zar?: number | null;
}

/** "14:00:00" → "14:00" (Postgres time columns carry seconds). */
function hhmm(time: string): string {
  return (time || '').slice(0, 5);
}

/**
 * Normalise a South African phone number to wa.me's international digits.
 * "063 123 4567" → "27631234567". Leaves already-international numbers alone.
 */
export function toWhatsappNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('27')) return digits;
  if (digits.startsWith('0')) return '27' + digits.slice(1);
  return digits;
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${toWhatsappNumber(phone)}?text=${encodeURIComponent(message)}`;
}

export function confirmedMessage(b: BookingLike): string {
  const where = b.is_home_call ? 'at your home' : 'at the spa';
  const parts = [
    `Hi ${b.customer_name}! Your booking at Chi Chi's Beauty Spa is confirmed: ` +
      `${b.service} (${b.duration}) on ${b.booking_date} at ${hhmm(b.booking_time)}, ${where}.`,
  ];
  if (b.payment_method === 'cash') {
    const amount = b.amount_zar != null ? `R${b.amount_zar} ` : '';
    parts.push(`Please bring ${amount}in cash and arrive 10 minutes early to complete payment.`);
  }
  if (!b.is_home_call) {
    parts.push('Free parking and a shower are available at the spa.');
  }
  parts.push('See you then!');
  return parts.join(' ');
}

export function rescheduledMessage(b: BookingLike): string {
  const where = b.is_home_call ? 'at your home' : 'at the spa';
  return (
    `Hi ${b.customer_name}! Your Chi Chi's Beauty Spa booking for ${b.service} has been ` +
    `moved to ${b.booking_date} at ${hhmm(b.booking_time)}, ${where}. Please reply to confirm ` +
    `this works for you. Thank you!`
  );
}

export function declinedMessage(b: BookingLike): string {
  const refunded = b.payment_method === 'paypal';
  return (
    `Hi ${b.customer_name}, thank you for your booking request for ${b.service} on ` +
    `${b.booking_date} at ${hhmm(b.booking_time)}. Unfortunately we're unable to confirm this slot.` +
    `${refunded ? ' Your payment has been fully refunded.' : ''} ` +
    `Please reply and we'll gladly find another time for you. - Chi Chi's Beauty Spa`
  );
}

/**
 * Neutral opener for contacting a customer about a booking that hasn't been
 * decided yet (used on the pending-confirmation rows).
 */
export function inquiryMessage(b: BookingLike): string {
  return (
    `Hi ${b.customer_name}, this is Chi Chi's Beauty Spa regarding your booking request: ` +
    `${b.service} (${b.duration}) on ${b.booking_date} at ${hhmm(b.booking_time)}.`
  );
}
