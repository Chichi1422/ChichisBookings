// app/routes/admin.logout.tsx
// Sign out the spa owner, clear cookies, redirect to /admin/login.

import { redirect } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { getSupabaseServerClient } from '~/lib/supabase.server';

async function signOut(request: Request) {
  const { supabase, headers } = getSupabaseServerClient(request);
  await supabase.auth.signOut();
  return redirect('/admin/login', { headers });
}

export async function action({ request }: ActionFunctionArgs) {
  return signOut(request);
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Allow GET so a plain link works.
  return signOut(request);
}
