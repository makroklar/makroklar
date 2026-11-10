import { parseFoodQuery } from '../data/foodSearchModel';
import type { FoodSearchResult } from '../types/catalogFood';

export interface FoodSearchState {
  searched: string;
  result: FoodSearchResult | null;
  pending: boolean;
}

// One instance per mounted search view. Timers/cache never survive navigation or logout.
export function createFoodSearch(
  search: (query: string) => Promise<FoodSearchResult>,
  publish: (state: FoodSearchState) => void,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  let disposed = false;
  const cache = new Map<string, { result: FoodSearchResult; expiresAt: number }>();
  const inFlight = new Map<string, Promise<FoodSearchResult>>();

  function cancelTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  async function run(input: string) {
    if (disposed) return;
    const currentRevision = ++revision;
    const searched = input.trim();
    let parsed;
    try { parsed = parseFoodQuery(input); } catch {
      publish({ searched, pending: false, result: { status: 'error',
        message: 'Gib mindestens zwei Buchstaben oder einen gültigen EAN-/UPC-Barcode ein.' } });
      return;
    }
    const key = `${parsed.kind}:${parsed.value.toLocaleLowerCase('de-DE')}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      publish({ searched, result: cached.result, pending: false });
      return;
    }
    // Enter and the debounce timer can request the same query; share that request.
    let request = inFlight.get(key);
    if (!request) {
      request = Promise.resolve().then(() => search(parsed.value))
        .catch((): FoodSearchResult => ({ status: 'error',
          message: 'Die Suche ist gerade nicht verfügbar. Bitte versuche es erneut.' }))
        .then(result => {
          inFlight.delete(key);
          if (!disposed && result.status === 'success') {
            if (cache.size >= 30) cache.clear();
            cache.set(key, { result, expiresAt: Date.now() + 5 * 60_000 });
          }
          return result;
        });
      inFlight.set(key, request);
    }
    publish({ searched, result: null, pending: true });
    const result = await request;
    // Server Actions cannot be aborted here. A superseded response may be cached,
    // but it must never replace results for the current input.
    if (!disposed && revision === currentRevision) publish({ searched, result, pending: false });
  }

  return {
    change(input: string, composing = false) {
      if (disposed) return;
      cancelTimer();
      revision++;
      publish({ searched: '', result: null, pending: false });
      if (composing) return;
      try {
        const parsed = parseFoodQuery(input);
        if (parsed.kind !== 'name' || (parsed.value.match(/\p{L}/gu)?.length ?? 0) < 3) return;
      } catch { return; }
      timer = setTimeout(() => { timer = undefined; void run(input); }, 500);
    },
    submit(input: string) {
      cancelTimer();
      return run(input);
    },
    dispose() {
      cancelTimer();
      revision++;
      disposed = true;
      cache.clear();
      inFlight.clear();
    },
  };
}
