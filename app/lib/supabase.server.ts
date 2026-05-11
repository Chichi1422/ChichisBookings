// Server-side Supabase clients. Never import from client code.

import { createClient } from '@supabase/supabase-js';
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
  type CookieOptions,
} from '@supabase/ssr';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceRoleKey || !anonKey) {
  // Surface during boot rather than at first request.
  console.warn('[supabase] missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY');
}

// Service-role client — bypasses RLS. Use only in server modules.
// Schema is set to 'app' so all .from('table') calls hit the private schema.
export const supabaseAdmin = createClient(url ?? '', serviceRoleKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'app' },
});

// Cookie-bound client used to read the admin's auth session from a Request.
// Returns the client plus a Headers object the caller must merge into the response
// so refreshed session cookies are written back to the browser.
export function getSupabaseServerClient(request: Request) {
  const headers = new Headers();
  const cookieHeader = request.headers.get('Cookie') ?? '';

  const supabase = createServerClient(url ?? '', anonKey ?? '', {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader).map(({ name, value }) => ({
          name,
          value: value ?? '',
        }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        for (const { name, value, options } of cookiesToSet) {
          headers.append('Set-Cookie', serializeCookieHeader(name, value, options ?? {}));
        }
      },
    },
  });

  return { supabase, headers };
}
