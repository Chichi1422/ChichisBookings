// app/routes/auth.callback.ts
// Supabase PKCE magic-link callback. The email link redirects here with a
// `?code=` parameter; we exchange it for a session cookie and forward to
// the requested page (defaults to /admin).

import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getSupabaseServerClient } from '~/lib/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/admin';

  if (!code) return redirect('/admin/login?error=no_code');

  const { supabase, headers } = getSupabaseServerClient(request);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth.callback] exchangeCodeForSession failed:', error);
    return redirect('/admin/login?error=auth_exchange_failed', { headers });
  }

  return redirect(next, { headers });
}
