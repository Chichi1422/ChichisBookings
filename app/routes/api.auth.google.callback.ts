// app/routes/api.auth.google.callback.ts
// OAuth callback for the spa's Google Calendar. Owner-only — the redirect_uri
// is registered in Google Cloud, but we still verify the requester is the
// owner before exchanging the code, otherwise anyone who can hit this URL
// could overwrite the spa's tokens.

import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { assertOwner } from '~/lib/auth.server';
import { exchangeCodeForTokens } from '~/lib/google-tokens.server';

export async function loader({ request }: LoaderFunctionArgs) {
  // Throws (redirect or 403) if the requester isn't the owner.
  const session = await assertOwner(request);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    console.error('Google OAuth error:', error);
    return redirect('/admin?error=auth_failed', { headers: session.headers });
  }
  if (!code) {
    return redirect('/admin?error=no_code', { headers: session.headers });
  }

  try {
    await exchangeCodeForTokens(code);
    return redirect('/admin?success=calendar_connected', { headers: session.headers });
  } catch (err) {
    console.error('Token exchange error:', err);
    return redirect('/admin?error=token_exchange_failed', { headers: session.headers });
  }
}
