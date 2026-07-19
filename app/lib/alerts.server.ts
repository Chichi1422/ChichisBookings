// Critical-failure email alerts to the owner, sent via the Resend API (the
// spa already has a Resend account with a verified sending domain).
//
// Fire-and-forget by design: alerting must never break the flow it reports on.
// If RESEND_API_KEY isn't configured, the alert degrades to a loud log line so
// nothing depends on the env being present.

import { reportError } from './sentry.server';

const RESEND_API = 'https://api.resend.com/emails';

export async function sendAlert(subject: string, lines: string[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL || process.env.OWNER_EMAIL;
  const from = process.env.ALERT_FROM || 'alerts@sender.chichisbeauty.com';

  // Every alert is also a Sentry issue (grouped by subject), so there's a
  // queryable history beyond the owner's inbox.
  await reportError(new Error(subject), { details: lines.join('\n') });

  if (!apiKey || !to) {
    console.error('[ALERT:unsent]', subject, '|', lines.join(' | '));
    return;
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Chi Chi's Bookings <${from}>`,
        to: [to],
        subject: `[Chi Chi's] ${subject}`,
        text: lines.join('\n'),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error('[alert] resend failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[alert] send error:', err);
  }
}
