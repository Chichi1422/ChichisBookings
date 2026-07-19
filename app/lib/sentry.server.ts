// Server-side Sentry reporting. Serverless-aware: lazy init, and an explicit
// flush after capture so events aren't lost when the function freezes.
//
// This instruments the chokepoints we control (sendAlert + catch blocks) —
// it is not blanket request instrumentation. Without SENTRY_DSN it's a no-op.

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
let initialized = false;

function ensureInit(): void {
  if (initialized || !dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || 'development',
    // Free tier: errors only, no performance tracing quota burn.
    tracesSampleRate: 0,
  });
  initialized = true;
}

export async function reportError(
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!dsn) return;
  try {
    ensureInit();
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      extra: context,
    });
    await Sentry.flush(2000);
  } catch (reportErr) {
    console.error('[sentry] report failed:', reportErr);
  }
}
