// app/routes/admin.login.tsx
// Magic-link sign-in for the spa owner. The OWNER_EMAIL env is the only
// account that can ever sign in here; any other address is rejected before
// Supabase even sees it (no info leak, no spam vector).

import { Form, redirect, useActionData, useNavigation } from 'react-router';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { getOwnerSession } from '~/lib/auth.server';
import { getSupabaseServerClient } from '~/lib/supabase.server';

export function meta() {
  return [{ title: "Admin sign-in | Chi Chi's Beauty Spa" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getOwnerSession(request);
  if (session) {
    return redirect('/admin', { headers: session.headers });
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;

  if (!ownerEmail) {
    return { ok: false, message: 'Server is not configured for admin sign-in.' };
  }

  // Always show the same success message — never reveal whether the email
  // matches the owner.
  if (email !== ownerEmail) {
    return { ok: true, message: 'If that address is the owner, a sign-in link is on its way.' };
  }

  const { supabase, headers } = getSupabaseServerClient(request);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${appUrl}/auth/callback?next=/admin` },
  });

  if (error) {
    console.error('[admin.login] signInWithOtp failed:', error);
    return { ok: false, message: 'Could not send sign-in link. Try again in a moment.' };
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: 'If that address is the owner, a sign-in link is on its way.',
    }),
    { headers: { ...Object.fromEntries(headers), 'Content-Type': 'application/json' } },
  );
}

export default function AdminLogin() {
  const data = useActionData<typeof action>() as { ok: boolean; message: string } | undefined;
  const nav = useNavigation();
  const submitting = nav.state === 'submitting';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex items-center justify-center">
      <div className="gradient-border rounded-2xl p-8 max-w-md w-full">
        <h1 className="font-playfair text-2xl mb-2">Admin Sign-in</h1>
        <p className="text-white/60 text-sm mb-6">
          Enter the spa owner email to receive a one-time sign-in link.
        </p>

        <Form method="post" className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Email</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="owner@example.com"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#f48fb1]/50 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send sign-in link'}
          </button>

          {data?.message && (
            <p
              className={`text-sm text-center ${
                data.ok ? 'text-green-300' : 'text-red-300'
              }`}
            >
              {data.message}
            </p>
          )}
        </Form>
      </div>
    </div>
  );
}
