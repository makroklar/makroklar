// Read only public application settings, lazily when a client is requested.
export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.',
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) project URL.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a public HTTP(S) project URL.');
  }
  if (!publishableKey.startsWith('sb_publishable_')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must contain a publishable key.');
  }

  return { url, publishableKey };
}
