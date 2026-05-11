// Persistent Google OAuth tokens, stored as a singleton row in app.oauth_tokens.

import { google } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import { supabaseAdmin } from './supabase.server';

function buildClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

async function loadTokens(): Promise<Credentials | null> {
  const { data, error } = await supabaseAdmin
    .from('oauth_tokens')
    .select('access_token, refresh_token, scope, token_type, expiry_date')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('[google-tokens] load failed:', error);
    return null;
  }
  if (!data) return null;

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    scope: data.scope ?? undefined,
    token_type: data.token_type ?? undefined,
    expiry_date: data.expiry_date ?? undefined,
  };
}

async function saveTokens(tokens: Credentials): Promise<void> {
  // Google may omit refresh_token on refresh — keep the original if so.
  const existing = await loadTokens();
  const refresh_token = tokens.refresh_token ?? existing?.refresh_token;
  if (!tokens.access_token || !refresh_token) {
    throw new Error('Cannot persist Google tokens without access_token + refresh_token');
  }

  const { error } = await supabaseAdmin
    .from('oauth_tokens')
    .upsert(
      {
        id: 1,
        access_token: tokens.access_token,
        refresh_token,
        scope: tokens.scope ?? null,
        token_type: tokens.token_type ?? null,
        expiry_date: tokens.expiry_date ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

  if (error) {
    console.error('[google-tokens] save failed:', error);
    throw new Error('Failed to persist Google tokens');
  }
}

/**
 * Returns an OAuth2Client wired with the spa's stored tokens.
 * Auto-refreshes and persists rotated tokens. Throws if no tokens are stored
 * — the owner needs to (re)connect the calendar at /admin.
 */
export async function getOAuthClient(): Promise<OAuth2Client> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error('Google Calendar not connected');

  const client = buildClient();
  client.setCredentials(tokens);
  client.on('tokens', (rotated) => {
    // Fire-and-forget; persist in background so we don't block the request.
    saveTokens({ ...tokens, ...rotated }).catch((err) =>
      console.error('[google-tokens] rotation persist failed:', err),
    );
  });
  return client;
}

/**
 * Generates the consent URL for the owner to start the OAuth flow.
 */
export function buildAuthUrl(): string {
  const client = buildClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token issuance
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
}

/**
 * Exchanges an OAuth code for tokens and persists them.
 */
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const client = buildClient();
  const { tokens } = await client.getToken(code);
  await saveTokens(tokens);
}

/**
 * True if the spa has previously connected a Google Calendar.
 */
export async function isCalendarConnected(): Promise<boolean> {
  const tokens = await loadTokens();
  return !!tokens?.refresh_token;
}
