import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig } from '@/shared/supabase/config';
import type { Database } from '@/shared/supabase/database.types';
import type { CatalogFood } from '../types/catalogFood';
import { catalogFoodSchema } from './onboardingModel';

// No cookies/user session: this credential is only used for the restricted cache RPC.
// Call with provider-verified candidates, never with browser data or tenant snapshots.
export async function publishOffCache(restaurantId: string, requestId: string, candidates: readonly CatalogFood[]) {
  if (!candidates.length) return;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) return;
  if (!secretKey.startsWith('sb_secret_')) throw new Error('Invalid server cache configuration.');
  const products = candidates.map(candidate => {
    const food = catalogFoodSchema.parse(candidate);
    if (food.source.kind !== 'off') throw new Error('Only provider products can be shared.');
    return food;
  });
  const { url } = getSupabasePublicConfig();
  const client = createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5_000) }) },
  });
  const result = await client.rpc('publish_confirmed_off_products', {
    target_restaurant_id: restaurantId, saved_request_id: requestId, products,
  });
  if (result.error) throw new Error('Shared product cache is unavailable.');
}
