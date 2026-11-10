// Server Actions already enforce Origin/Host checks; Supabase also checks its redirect allow-list.
export function registrationCallbackUrl(origin: string | null) {
  if (!origin) throw new Error('Registration requires a request origin.');
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.origin !== origin) {
    throw new Error('Registration requires an HTTP(S) origin.');
  }
  return new URL('/business/auth/callback', url).href;
}
