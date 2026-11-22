import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/shared/supabase/server';

export async function handleRegistrationCallback(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL('/business/register?registration=confirmation-error', request.url),
    303,
  );
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  const query = request.nextUrl.searchParams;
  if (query.has('error') || query.has('error_code')) return response;

  let authenticated = false;
  try {
    // The same response retains SDK cache headers; Next forwards cookie-store writes.
    const supabase = await createClient(response.headers);
    const code = query.get('code');
    if (code) {
      const flowId = query.get('sb_flow_id');
      const { error } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (error) return response;
    }

    // Also supports resuming setup with a verified session after a failed RPC.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email_confirmed_at) return response;
    authenticated = true;
    const result = await supabase.rpc('complete_restaurant_registration');
    if (result.error || !result.data) {
      response.headers.set('Location', new URL('/business/register?registration=setup-error', request.url).href);
      return response;
    }

    // Fixed local destination. Never trust next/redirect_to parameters from a link.
    response.headers.set('Location', new URL('/business/welcome', request.url).href);
  } catch {
    if (authenticated) {
      response.headers.set('Location', new URL('/business/register?registration=setup-error', request.url).href);
    }
  }
  return response;
}
