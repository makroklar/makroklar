import type { createClient } from '@/shared/supabase/server';
import { fromOpenFoodFacts } from './foodSearchModel';
import { catalogFoodSchema } from './onboardingModel';
import type { CatalogFood, FoodSearchResult } from '../types/catalogFood';

const requests: number[] = [];
const recent = new Map<string, { food: CatalogFood; at: number }>();
const inFlight = new Map<string, Promise<OffResult>>();
const day = 24 * 60 * 60_000;

type OffResult = FoodSearchResult & { cacheCandidate?: CatalogFood };

function parseProduct(value: unknown, barcode: string) {
  const parsed = catalogFoodSchema.safeParse(value);
  return parsed.success && parsed.data.source.kind === 'off' && parsed.data.source.barcode === barcode ? parsed.data : null;
}

export async function getOffProduct(barcode: string, client: Awaited<ReturnType<typeof createClient>>, options: { forSave?: boolean } = {}): Promise<OffResult> {
  if (options.forSave) {
    // Preserve the restaurant's accepted snapshot, even when the shared cache changes.
    // Tenant data is never promoted into the shared cache (direct RPC callers can edit it).
    const saved = await client.rpc('read_saved_off_product', { barcode });
    if (saved.error) return { status: 'error', message: 'Gespeicherte Produktdaten konnten nicht geprüft werden. Bitte versuche es erneut.' };
    const own = parseProduct(saved.data, barcode);
    if (own) return { status: 'success', foods: [own], hasMore: false };
    if (saved.data !== null) return { status: 'error', message: 'Gespeicherte Produktdaten sind unvollständig. Bitte prüfe dieses Lebensmittel.' };
  }
  // Shared data contains provider fields only, never another restaurant's selections.
  // A missing migration/cache is a miss; the normal OFF lookup remains available.
  const saved = await client.rpc('read_shared_off_product', { barcode });
  const parsed = catalogFoodSchema.safeParse(saved.data);
  if (!saved.error && parsed.success && parsed.data.source.kind === 'off' && parsed.data.source.barcode === barcode) {
    const age = Date.now() - Date.parse(parsed.data.source.fetchedAt);
    if (age >= 0 && age < 30 * day) return { status: 'success', foods: [parsed.data], hasMore: false };
  }
  if (!options.forSave) {
    // Preserve the existing tenant cache while shared-cache activation is pending.
    // Its values remain private; they are never eligible for shared publication.
    const savedOwn = await client.rpc('read_saved_off_product', { barcode });
    const own = parseProduct(savedOwn.data, barcode);
    if (!savedOwn.error && own?.source.kind === 'off') {
      const age = Date.now() - Date.parse(own.source.fetchedAt);
      if (age >= 0 && age < 30 * day) return { status: 'success', foods: [own], hasMore: false };
    }
  }
  const cached = recent.get(barcode);
  const memoryAge = (options.forSave ? 30 : 5) * 60_000;
  if (cached && Date.now() - cached.at >= 0 && Date.now() - cached.at < memoryAge) {
    return { status: 'success', foods: [cached.food], hasMore: false, cacheCandidate: cached.food };
  }
  const pending = inFlight.get(barcode);
  if (pending) return pending;
  const work = fetchProduct(barcode).finally(() => inFlight.delete(barcode));
  inFlight.set(barcode, work);
  return work;
}

async function fetchProduct(barcode: string): Promise<OffResult> {
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
    const food = catalogFoodSchema.parse(fromOpenFoodFacts(await response.json(), barcode, new Date().toISOString()));
    if (recent.size >= 200) recent.clear();
    recent.set(barcode, { food, at: Date.now() });
    return { status: 'success', foods: [food], hasMore: false, cacheCandidate: food };
  } catch { return { status: 'error', message: 'Open Food Facts ist gerade nicht verfügbar. Bitte versuche es erneut.' }; }
}
