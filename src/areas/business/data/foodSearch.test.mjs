import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { beforeEach, after } from 'node:test';
import { appendCatalogFood, hasCompleteCatalogNutrition, fromBls, fromOpenFoodFacts, literalNamePattern, normalizeBarcode, parseFoodQuery } from './foodSearchModel.ts';

const serverMock = 'data:text/javascript,' + encodeURIComponent('export const createClient = async () => globalThis.__foodClient;');
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/shared/supabase/server') return { url: serverMock, shortCircuit: true };
  if (['./foodSearchModel', './offProducts', './onboardingModel', './recipeDraft'].includes(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { searchFoods } = await import('./searchFoodsAction.ts');
const barcode = '3017620422003';
const dataset = { id: 'dataset-1', source_version: '4.0', basis_quantity: 100, basis_unit: 'g' };
const definitions = [{ code: 'ENERCC', unit: 'kcal' }, { code: 'PROT625', unit: 'g' }, { code: 'FAT', unit: 'g' }, { code: 'CHO', unit: 'g' }];
const values = definitions.map((row, i) => ({ bls_code: 'A100', nutrient_code: row.code, value_kind: 'numeric', value: i }));
function off() {
  const nutrients = Object.fromEntries(['energy-kcal', 'proteins', 'fat', 'carbohydrates'].map((key, i) => [key, { value: i, unit: i ? 'g' : 'kcal', source: 'packaging' }]));
  return { status: 'success', product: { code: barcode, product_name: 'Test product', product_name_de: 'Testprodukt',
    nutrition: { aggregated_set: { per: '100g', preparation: 'as_sold', nutrients } } } };
}
let state;
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
let clock = originalNow();
after(() => { globalThis.fetch = originalFetch; Date.now = originalNow; delete globalThis.__foodClient; });
beforeEach(() => {
  clock += 31 * 60_000;
  Date.now = () => clock;
  state = { user: { id: 'owner' }, authError: null, tables: [], requests: [], status: 200, body: off(), dbError: false,
    datasets: dataset, foods: [{ bls_code: 'A100', name_de: 'Apfel' }], values, definitions };
  globalThis.fetch = async (url, options) => {
    state.requests.push({ url: String(url), options });
    return new Response(JSON.stringify(state.body), { status: state.status });
  };
  globalThis.__foodClient = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: state.authError }) },
    rpc: async name => { assert.equal(name, 'read_saved_off_product'); return { data: state.cached ?? null, error: null }; },
    from(table) {
      const call = { table, filters: [] }; state.tables.push(call);
      const data = { nutrition_datasets: state.datasets, bls_foods: state.foods, bls_food_nutrients: state.values, nutrients: state.definitions }[table];
      assert.notEqual(data, undefined, `Unexpected table: ${table}`);
      const query = {
        select(value) { call.select = value; return query; },
        eq(...args) { call.filters.push(['eq', ...args]); return query; },
        in(...args) { call.filters.push(['in', ...args]); return query; },
        ilike(...args) { call.filters.push(['ilike', ...args]); return query; },
        order(value) { (call.orders ??= []).push(value); return query; },
        limit(value) { call.limit = value; return query; },
        maybeSingle() { return query; },
        then(resolve) { return Promise.resolve({ data, error: state.dbError ? { message: 'private details' } : null }).then(resolve); },
      };
      // No mutations; the only RPC above is a read under RLS.
      return query;
    },
  };
});

test('names stay names; valid EAN/UPC preserve canonical identity and invalid checksums fail', () => {
  assert.deepEqual(parseFoodQuery('  Apfel  '), { kind: 'name', value: 'Apfel' });
  assert.deepEqual(parseFoodQuery('3017 6204 22003'), { kind: 'barcode', value: barcode });
  assert.equal(parseFoodQuery('034000470693').value, '0034000470693');
  assert.equal(normalizeBarcode('0034000470693'), '0034000470693');
  for (const input of ['', 'a', '1'.repeat(101), null, {}, '123', '3017620422004', '00000000']) assert.throws(() => parseFoodQuery(input));
  assert.equal(literalNamePattern('50%_\\'), '%50\\%\\_\\\\%');
});

test('OFF v3 aggregate keeps explicit 100ml, preparation, zero, source identity and timestamp', () => {
  const input = off(); input.product.nutrition.aggregated_set.per = '100ml';
  input.product.nutrition.aggregated_set.preparation = 'prepared';
  const food = fromOpenFoodFacts(input, barcode, '2026-11-11T10:00:00Z');
  assert.equal(food.name, 'Testprodukt'); assert.equal(food.basis, '100ml');
  assert.equal(food.preparation, 'prepared'); assert.equal(food.energyKcal, 0);
  assert.equal(food.source.barcode, barcode); assert.equal(food.source.fetchedAt, '2026-11-11T10:00:00Z');
  assert.equal(hasCompleteCatalogNutrition(food), true);
});

test('missing, estimated, qualified, computed-only, negative and wrong-unit nutrients never become invented numbers', () => {
  for (const nutrient of [undefined, { value: 0, unit: 'mg' }, { value: -1, unit: 'g' },
    { value: 2, unit: 'g', modifier: '<' }, { value: 2, unit: 'g', source: 'estimate' }, { value_computed: 2, unit: 'g' }]) {
    const input = off(); input.product.nutrition.aggregated_set.nutrients.fat = nutrient;
    const food = fromOpenFoodFacts(input, barcode, 'now');
    assert.equal(food.fatG, null); assert.equal(hasCompleteCatalogNutrition(food), false);
  }
  const input = off(); delete input.product.nutrition.aggregated_set.nutrients.carbohydrates;
  input.product.nutrition.aggregated_set.nutrients['carbohydrates-total'] = { value: 5, unit: 'g' };
  assert.equal(fromOpenFoodFacts(input, barcode, 'now').carbohydrateG, null);
});

test('unknown/serving basis cannot be silently treated as 100g; unexpected payloads fail', () => {
  for (const per of [undefined, 'serving', '250g']) {
    const input = off(); input.product.nutrition.aggregated_set.per = per;
    const food = fromOpenFoodFacts(input, barcode, 'now');
    assert.equal(food.basis, null); assert.equal(food.energyKcal, null); assert.equal(hasCompleteCatalogNutrition(food), false);
  }
  for (const input of [{}, { ...off(), status: 'failure' }, { ...off(), product: { code: '999' } }]) assert.throws(() => fromOpenFoodFacts(input, barcode, 'now'));
});

test('BLS retains dataset/version/code and missing/trace/wrong units remain null', () => {
  const food = fromBls(state.foods[0], dataset, values, definitions);
  assert.equal(food.energyKcal, 0); assert.equal(food.basis, '100g'); assert.equal(food.preparation, null);
  assert.deepEqual(food.source, { kind: 'bls', datasetId: dataset.id, code: 'A100', version: '4.0' });
  for (const value_kind of ['missing', 'trace', 'below_loq', 'below_lod']) {
    assert.equal(fromBls(state.foods[0], dataset, values.map(row => ({ ...row, value_kind })), definitions).fatG, null);
  }
  assert.equal(fromBls(state.foods[0], dataset, values, []).fatG, null);
});

test('selection is immutable and idempotent, including incomplete products without inventing zeros', () => {
  const food = fromOpenFoodFacts(off(), barcode, 'now');
  const selected = appendCatalogFood([], food);
  assert.equal(appendCatalogFood(selected, { ...food, name: 'Another label' }).length, 1);
  const incomplete = { ...food, energyKcal: 0, proteinG: null, fatG: null, carbohydrateG: null };
  const collected = appendCatalogFood([], incomplete);
  assert.deepEqual(collected, [incomplete]);
  assert.equal(hasCompleteCatalogNutrition(collected[0]), false);
  assert.equal(collected[0].energyKcal, 0);
  assert.equal(collected[0].fatG, null);
  assert.equal(appendCatalogFood(collected, incomplete).length, 1);
  selected[0].source.barcode = 'changed'; assert.equal(food.source.barcode, barcode);
});

test('invalid inputs and signed-out users do not query BLS or call OFF', async () => {
  assert.equal((await searchFoods('123')).status, 'error');
  state.user = null;
  for (const query of ['Apfel', barcode]) assert.equal((await searchFoods(query)).status, 'error');
  state.user = { id: 'forged' }; state.authError = { message: 'invalid token' };
  assert.equal((await searchFoods(barcode)).status, 'error');
  assert.equal(state.tables.length, 0); assert.equal(state.requests.length, 0);
});

test('name search reads only active BLS, returns four mapped nutrients, never calls OFF', async () => {
  const result = await searchFoods('Apfel');
  assert.equal(result.status, 'success'); assert.equal(result.foods[0].name, 'Apfel');
  assert.equal(result.foods[0].energyKcal, 0); assert.equal(state.requests.length, 0);
  assert.deepEqual(state.tables[0].filters, [['eq', 'source', 'bls'], ['eq', 'is_active', true]]);
  assert.equal(state.tables[1].limit, 21);
  assert.ok(state.tables.slice(1).every(call => call.filters.some(filter => filter[1] === 'dataset_id' && filter[2] === dataset.id)));
});

test('name results are capped at 20 with a visible more-results signal; empty search skips nutrients', async () => {
  state.foods = Array.from({ length: 21 }, (_, i) => ({ bls_code: `A${i}`, name_de: `Apfel ${i}` }));
  const result = await searchFoods('Apfel');
  assert.equal(result.foods.length, 20); assert.equal(result.hasMore, true);
  state.foods = []; state.tables = [];
  assert.deepEqual(await searchFoods('Unknown'), { status: 'success', foods: [], hasMore: false });
  assert.equal(state.tables.length, 2); assert.equal(state.requests.length, 0);
});

test('database failures are not presented as empty results and do not leak details', async () => {
  state.dbError = true;
  const result = await searchFoods('Apfel');
  assert.equal(result.status, 'error'); assert.equal(result.message.includes('private'), false);
});

test('barcode lookup runs server-side with fixed host, identification, timeout, no automatic redirects or persistent cache', async () => {
  const result = await searchFoods(barcode);
  assert.equal(result.status, 'success'); assert.equal(result.foods[0].source.barcode, barcode);
  assert.equal(state.tables.length, 0);
  const request = state.requests[0];
  assert.equal(new URL(request.url).hostname, 'world.openfoodfacts.org');
  assert.ok(new URL(request.url).pathname.endsWith('/api/v3.6/product/' + barcode));
  assert.match(request.options.headers['User-Agent'], /^makroklar\/0.1.0/);
  assert.equal(request.options.cache, 'no-store'); assert.equal(request.options.redirect, 'error');
  assert.ok(request.options.signal instanceof AbortSignal);
});

test('OFF not-found, rate limit and malformed responses are distinguished without retrying', async () => {
  state.status = 404; assert.deepEqual(await searchFoods(barcode), { status: 'success', foods: [], hasMore: false });
  state.status = 429; assert.match((await searchFoods(barcode)).message, /Open Food Facts/);
  state.status = 200; state.body = { private: 'unexpected' }; assert.equal((await searchFoods(barcode)).status, 'error');
  assert.equal(state.requests.length, 3);
});

test('network failures become retry feedback and the per-process quota prevents excessive OFF calls', async () => {
  globalThis.fetch = async () => { state.requests.push({}); throw new Error('private network details'); };
  const failure = await searchFoods(barcode);
  assert.equal(failure.status, 'error'); assert.equal(failure.message.includes('private'), false);
  for (let i = 0; i < 15; i++) await searchFoods(barcode);
  assert.ok(state.requests.length <= 12);
  assert.match((await searchFoods(barcode)).message, /eine Minute/);
});

test('confirmed OFF snapshot is reused for 30 days; stale records are refreshed without writing on search', async () => {
  state.cached = fromOpenFoodFacts(off(), barcode, new Date(clock - 29 * 86400000).toISOString());
  assert.equal((await searchFoods(barcode)).status, 'success');
  assert.equal(state.requests.length, 0);
  state.cached.source.fetchedAt = new Date(clock - 31 * 86400000).toISOString();
  assert.equal((await searchFoods(barcode)).status, 'success');
  assert.equal(state.requests.length, 1);
});

test('unconfirmed OFF results stay in process memory for five minutes; concurrent requests share one fetch', async () => {
  const results = await Promise.all([searchFoods(barcode), searchFoods(barcode)]);
  assert.ok(results.every(result => result.status === 'success'));
  assert.equal(state.requests.length, 1);
  clock += 4 * 60_000;
  await searchFoods(barcode);
  assert.equal(state.requests.length, 1);
  clock += 2 * 60_000;
  await searchFoods(barcode);
  assert.equal(state.requests.length, 2);
});
