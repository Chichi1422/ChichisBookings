// app/lib/google.server.ts
// Service-account-based Google Calendar client. The spa shares a specific
// calendar (`GOOGLE_CALENDAR_ID`) with the service account email and grants
// "Make changes to events". No OAuth, no refresh tokens, no consent flow.

import { google, type calendar_v3 } from 'googleapis';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id?: string;
}

function loadServiceAccountKey(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not set. Paste the service account JSON key into this env var.',
    );
  }

  // Vercel and some env loaders preserve the JSON exactly as pasted, others
  // re-escape newlines in the private_key field. Try plain JSON first;
  // fall back to base64 if it looks like a base64 blob.
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON or base64-encoded JSON');
    }
  }

  // The private_key in the downloaded JSON contains literal "\n" escape
  // sequences when it was originally written. JSON.parse turns them into
  // real newlines, but some hosts double-escape during paste. Normalise.
  if (typeof parsed.private_key === 'string' && parsed.private_key.includes('\\n')) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON missing client_email or private_key');
  }
  return parsed as ServiceAccountKey;
}

let cachedClient: calendar_v3.Calendar | null = null;

/**
 * Returns a Google Calendar client authenticated as the service account.
 * The client is cached for the lifetime of the function instance —
 * GoogleAuth handles internal token caching/refresh on top of that.
 */
export function getCalendarClient(): calendar_v3.Calendar {
  if (cachedClient) return cachedClient;
  const credentials = loadServiceAccountKey();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  cachedClient = google.calendar({ version: 'v3', auth });
  return cachedClient;
}

/** Calendar to read/write events from. */
export function getCalendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error('GOOGLE_CALENDAR_ID not configured');
  return id;
}

/** Cheap config check — doesn't talk to Google. */
export function isCalendarConfigured(): boolean {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !!process.env.GOOGLE_CALENDAR_ID;
}

/**
 * Verifies the service account can actually read the configured calendar.
 * Returns null on success, an error message on failure. Used by the admin
 * panel to confirm the share/permission setup is correct.
 */
export async function verifyCalendarAccess(): Promise<string | null> {
  if (!isCalendarConfigured()) {
    return 'GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_CALENDAR_ID is not set.';
  }
  try {
    const calendar = getCalendarClient();
    await calendar.calendars.get({ calendarId: getCalendarId() });
    return null;
  } catch (err: any) {
    const reason =
      err?.response?.data?.error?.message ||
      err?.errors?.[0]?.message ||
      err?.message ||
      'unknown';
    return reason;
  }
}
