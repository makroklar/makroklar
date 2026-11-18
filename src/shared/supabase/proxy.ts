import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicConfig } from './config';
import type { Database } from './database.types';

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabasePublicConfig();
  const updatedCookies: { name: string; value: string; options: CookieOptions }[] = [];
  const cacheHeaders = new Headers();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies, headers) {
        for (const cookie of cookies) {
          request.cookies.set(cookie.name, cookie.value);
          updatedCookies.push(cookie);
        }
        for (const [name, value] of Object.entries(headers)) {
          cacheHeaders.set(name, value);
        }
      },
    },
  });

  // Verify/refresh if a session exists. Public business pages remain accessible.
  await supabase.auth.getClaims();

  // Build once, after refresh, so downstream rendering receives the current cookies.
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const cookie of updatedCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  cacheHeaders.forEach((value, name) => response.headers.set(name, value));
  return response;
}
