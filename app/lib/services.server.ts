// Authoritative service catalog. Prices are matched server-side at reservation
// time so a tampered client can't pay an arbitrary amount.

export const HOME_CALL_FEE_ZAR = 250;

export interface ServicePrice {
  service: string;
  duration: string;
  durationMinutes: number;
  priceZar: number;
}

const CATALOG: ServicePrice[] = [
  // Swedish Massage / Aroma Therapy
  { service: 'Swedish Massage / Aroma Therapy', duration: '30 min', durationMinutes: 30, priceZar: 400 },
  { service: 'Swedish Massage / Aroma Therapy', duration: '60 min', durationMinutes: 60, priceZar: 600 },
  { service: 'Swedish Massage / Aroma Therapy', duration: '90 min', durationMinutes: 90, priceZar: 800 },
  // Deep Tissue / Sports Massage
  { service: 'Deep Tissue / Sports Massage', duration: '30 min', durationMinutes: 30, priceZar: 500 },
  { service: 'Deep Tissue / Sports Massage', duration: '60 min', durationMinutes: 60, priceZar: 700 },
  { service: 'Deep Tissue / Sports Massage', duration: '90 min', durationMinutes: 90, priceZar: 900 },
  // Hot Stone Therapy
  { service: 'Hot Stone Therapy', duration: '30 min', durationMinutes: 30, priceZar: 400 },
  { service: 'Hot Stone Therapy', duration: '60 min', durationMinutes: 60, priceZar: 750 },
  { service: 'Hot Stone Therapy', duration: '90 min', durationMinutes: 90, priceZar: 950 },
  // Reflexology
  { service: 'Reflexology', duration: '30 min', durationMinutes: 30, priceZar: 350 },
  // Neck Shoulder and Back
  { service: 'Neck Shoulder and Back', duration: '30 min', durationMinutes: 30, priceZar: 300 },
  { service: 'Neck Shoulder and Back', duration: '60 min', durationMinutes: 60, priceZar: 450 },
  // Pedicures
  { service: 'Pedicure (no gel)', duration: '30 min', durationMinutes: 30, priceZar: 300 },
  { service: 'Pedicure (with gel)', duration: '30 min', durationMinutes: 30, priceZar: 400 },
];

export function lookupService(service: string, duration: string): ServicePrice | null {
  const match = CATALOG.find(
    (s) =>
      s.service.toLowerCase() === service.trim().toLowerCase() &&
      s.duration.toLowerCase() === duration.trim().toLowerCase(),
  );
  return match ?? null;
}

export function totalPrice(service: ServicePrice, isHomeCall: boolean): number {
  return service.priceZar + (isHomeCall ? HOME_CALL_FEE_ZAR : 0);
}
