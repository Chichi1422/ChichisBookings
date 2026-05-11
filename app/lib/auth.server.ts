// Owner-only auth gate. Every admin route/action must call assertOwner.

import { redirect } from 'react-router';
import { getSupabaseServerClient } from './supabase.server';

export interface OwnerSession {
  email: string;
  headers: Headers;
}

/**
 * Verifies the request is from the spa owner.
 * - Not signed in → redirects to /admin/login.
 * - Signed in as someone else → 403.
 *
 * Returns the headers from the cookie-bound client so callers can merge
 * any refreshed-session cookies into their response.
 */
export async function assertOwner(request: Request): Promise<OwnerSession> {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) {
    // Misconfigured deploy — fail closed rather than letting anyone in.
    throw new Response('Owner email not configured', { status: 500 });
  }

  const { supabase, headers } = getSupabaseServerClient(request);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw redirect('/admin/login', { headers });
  }

  const userEmail = data.user.email?.trim().toLowerCase();
  if (userEmail !== ownerEmail) {
    throw new Response('Forbidden', { status: 403, headers });
  }

  return { email: userEmail, headers };
}

/**
 * Same check as assertOwner but returns null instead of throwing.
 * Used by login route to short-circuit if already signed in.
 */
export async function getOwnerSession(request: Request): Promise<OwnerSession | null> {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) return null;

  const { supabase, headers } = getSupabaseServerClient(request);
  const { data } = await supabase.auth.getUser();

  const userEmail = data.user?.email?.trim().toLowerCase();
  if (!userEmail || userEmail !== ownerEmail) return null;

  return { email: userEmail, headers };
}
