import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabasePublicConfig } from './config';
import type { Database } from './database.types';

// Create per request. Route Handlers can pass their outgoing response.headers.
export async function createClient(responseHeaders?: Headers) {
  const { url, publishableKey } = getSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(updatedCookies, cacheHeaders) {
        try {
          for (const cookie of updatedCookies) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
          if (responseHeaders) {
            for (const [name, value] of Object.entries(cacheHeaders)) {
              responseHeaders.set(name, value);
            }
          }
        } catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith(
            'Cookies can only be modified in a Server Action or Route Handler.',
          )) {
            throw error;
          }
          // RSC cookies are read-only. A session-refresh Proxy is required before enabling Auth.
        }
      },
    },
  });
}
