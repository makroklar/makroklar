'use server';

import { createClient } from '@/shared/supabase/server';
import { blsNutrients, fromBls, fromOpenFoodFacts, literalNamePattern, parseFoodQuery } from './foodSearchModel';
import type { FoodSearchResult } from '../types/catalogFood';

// Conservative per-process protection for OFF's shared read quota. Not a distributed limiter.
const offRequests: number[] = [];

export async function searchFoods(input: unknown): Promise<FoodSearchResult> {
  let query;
  try { query = parseFoodQuery(input); } catch {
    return { status: 'error', message: 'Gib mindestens zwei Buchstaben oder einen gültigen EAN-/UPC-Barcode ein.' };
  }
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { status: 'error', message: 'Bitte melde dich erneut an, um Lebensmittel zu suchen.' };

    if (query.kind === 'barcode') {
      const now = Date.now();
      while (offRequests.length && offRequests[0] <= now - 60_000) offRequests.shift();
      if (offRequests.length >= 12) return { status: 'error', message: 'Zu viele Barcode-Abfragen. Bitte warte eine Minute.' };
      offRequests.push(now);
      // No durable OFF cache exists yet. Search never writes to the database.
      const url = new URL(`https://world.openfoodfacts.org/api/v3.6/product/${query.value}`);
      url.searchParams.set('fields', 'code,product_name,product_name_de,brands,quantity,nutrition,last_modified_t');
      url.searchParams.set('lc', 'de');
      const response = await fetch(url, {
        headers: { 'User-Agent': 'makroklar/0.1.0 (https://github.com/chiaradjml/makroklar)' },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8_000),
      });
      if (response.status === 404) return { status: 'success', foods: [], hasMore: false };
      if (response.status === 429) return { status: 'error', message: 'Open Food Facts erhält gerade zu viele Anfragen. Bitte versuche es später erneut.' };
      if (!response.ok) throw new Error('OFF unavailable');
      const food = fromOpenFoodFacts(await response.json(), query.value, new Date().toISOString());
      return { status: 'success', foods: [food], hasMore: false };
    }

    const { data: dataset, error: datasetError } = await client.from('nutrition_datasets')
      .select('id, source_version, basis_quantity, basis_unit').eq('source', 'bls').eq('is_active', true).maybeSingle();
    if (datasetError || !dataset || dataset.basis_quantity !== 100 || dataset.basis_unit !== 'g') throw new Error('BLS unavailable');
    const { data: foods, error: foodError } = await client.from('bls_foods')
      .select('bls_code, name_de').eq('dataset_id', dataset.id).ilike('name_de', literalNamePattern(query.value))
      .order('name_de').order('bls_code').limit(21);
    if (foodError || !foods) throw new Error('BLS search failed');
    if (!foods.length) return { status: 'success', foods: [], hasMore: false };
    const visible = foods.slice(0, 20);
    const codes = Object.values(blsNutrients).map(([code]) => code);
    const [values, definitions] = await Promise.all([
      client.from('bls_food_nutrients').select('bls_code, nutrient_code, value, value_kind')
        .eq('dataset_id', dataset.id).in('bls_code', visible.map(food => food.bls_code)).in('nutrient_code', codes),
      client.from('nutrients').select('code, unit').eq('dataset_id', dataset.id).in('code', codes),
    ]);
    if (values.error || definitions.error || !values.data || !definitions.data) throw new Error('BLS nutrition unavailable');
    return { status: 'success', hasMore: foods.length > 20,
      foods: visible.map(food => fromBls(food, dataset, values.data, definitions.data)) };
  } catch {
    return { status: 'error', message: 'Die Suche ist gerade nicht verfügbar. Bitte versuche es erneut.' };
  }
}
