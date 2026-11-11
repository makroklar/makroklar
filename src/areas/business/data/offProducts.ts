import type { createClient } from '@/shared/supabase/server';
import { fromOpenFoodFacts } from './foodSearchModel';
import { catalogFoodSchema } from './onboardingModel';
import type { CatalogFood, FoodSearchResult } from '../types/catalogFood';

const requests: number[] = [];
const recent = new Map<string, { food: CatalogFood; at: number }>();
const inFlight = new Map<string, Promise<FoodSearchResult>>();
const day = 24 * 60 * 60_000;

export async function getOffProduct(barcode: string, client: Awaited<ReturnType<typeof createClient>>, options: { forSave?: boolean } = {}): Promise<FoodSearchResult> {
  // Only products previously confirmed by an owner are cached durably, under RLS.
  const saved = await client.rpc('read_saved_off_product', { barcode });
  const parsed = catalogFoodSchema.safeParse(saved.data);
  if (parsed.success && parsed.data.source.kind === 'off' && parsed.data.source.barcode === barcode) {
    const age = Date.now() - Date.parse(parsed.data.source.fetchedAt);
    if (age >= 0 && age < 30 * day) return { status: 'success', foods: [parsed.data], hasMore: false };
  }
  const cached = recent.get(barcode);
  const memoryAge = (options.forSave ? 30 : 5) * 60_000;
  if (cached && Date.now() - cached.at < memoryAge) return { status: 'success', foods: [cached.food], hasMore: false };
  const pending = inFlight.get(barcode);
  if (pending) return pending;
  const work = fetchProduct(barcode).finally(() => inFlight.delete(barcode));
  inFlight.set(barcode, work);
  return work;
}

async function fetchProduct(barcode: string): Promise<FoodSearchResult> {
  const now = Date.now();
  while (requests.length && requests[0] <= now - 60_000) requests.shift();
  if (requests.length >= 12) return { status: 'error', message: 'Zu viele Barcode-Abfragen. Bitte warte eine Minute und versuche es erneut.' };
  requests.push(now);
  try {
    const url = new URL(`https://world.openfoodfacts.org/api/v3.6/product/${barcode}`);
    url.searchParams.set('fields', 'code,product_name,product_name_de,brands,quantity,nutrition,last_modified_t');
    url.searchParams.set('lc', 'de');
    const response = await fetch(url, { headers: { 'User-Agent': 'makroklar/0.1.0 (https://github.com/chiaradjml/makroklar)' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (response.status === 404) return { status: 'success', foods: [], hasMore: false };
    if (response.status === 429) return { status: 'error', message: 'Open Food Facts erhält gerade zu viele Anfragen. Bitte versuche es später erneut.' };
    if (!response.ok) throw new Error('OFF unavailable');
    const food = fromOpenFoodFacts(await response.json(), barcode, new Date().toISOString());
    if (recent.size >= 200) recent.clear();
    recent.set(barcode, { food, at: Date.now() });
    return { status: 'success', foods: [food], hasMore: false };
  } catch { return { status: 'error', message: 'Open Food Facts ist gerade nicht verfügbar. Bitte versuche es erneut.' }; }
}
