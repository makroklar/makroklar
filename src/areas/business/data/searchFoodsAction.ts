'use server';

import { createClient } from '@/shared/supabase/server';
import { blsNutrients, fromBls, literalNamePattern, parseFoodQuery } from './foodSearchModel';
import { getOffProduct } from './offProducts';
import type { FoodSearchResult } from '../types/catalogFood';

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
      return await getOffProduct(query.value, client);
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
