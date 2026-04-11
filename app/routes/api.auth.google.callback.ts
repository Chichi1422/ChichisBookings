// app/routes/api.auth.google.callback.ts
// OAuth callback handler for Google Calendar authentication

import { redirect } from 'react-router';

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    console.error('Google OAuth error:', error);
    return redirect('/admin?error=auth_failed');
  }

  if (!code) {
    return redirect('/admin?error=no_code');
  }

  // Exchange code for tokens
  try {
    const formData = new FormData();
    formData.append('intent', 'setTokens');
    formData.append('code', code);

    const response = await fetch(`${process.env.APP_URL}/api/calendar`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    
    if (result.success) {
      return redirect('/admin?success=calendar_connected');
    } else {
      return redirect('/admin?error=token_exchange_failed');
    }
  } catch (err) {
    console.error('Token exchange error:', err);
    return redirect('/admin?error=server_error');
  }
}