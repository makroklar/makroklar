import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { beforeEach } from 'node:test';

const moduleFor = code => ({ url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === './savedMenu') return moduleFor('export const getMenuSession = async () => globalThis.__onboardingSession;');
  if (specifier === './offProducts') return moduleFor('export const getOffProduct = async () => globalThis.__offVerification;');
  if (specifier === './offCache') return moduleFor('export const publishOffCache = (...args) => globalThis.__publishOffCache(...args);');
  if (specifier === 'next/cache') return moduleFor('export const revalidatePath = () => {};');
  if (['./onboardingModel','./foodSearchModel','./recipeDraft','./basisOnboardingModel'].includes(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { newDishSchema, recipeErrors } = await import('./recipeDraft.ts');
const { onboardingPayloadSchema, completionSummarySchema } = await import('./onboardingModel.ts');
const { finishOnboarding } = await import('./finishOnboardingAction.ts');
const { readOnboarding } = await import('./readOnboarding.ts');
const id = 'f7110000-0000-4000-8000-000000000100';
const dishId = 'f7110000-0000-4000-8000-000000000300';
const key = `manual-${dishId}`;
const food = { id, name: 'Test', basis: '100g', preparation: 'as_sold', energyKcal: 100, proteinG: 10, fatG: 1, carbohydrateG: 20,
  sourceKind: 'label', sourceDescription: 'Packaging', noticeVersion: '2026-11-10.2' };
const payload = () => ({ schemaVersion: 2, basisRecipes: [], dishBases: {}, deletedBasisIds: [],
  importedIds: [], customDishes: [{ id: dishId, name: 'Suppe', price: null }], manualFoods: [{ ...food }], catalogFoods: [],
  recipes: { [key]: { servings: '2', ingredients: [{ foodId: id, quantity: '12,50', unit: 'g' }] } } });
const emptySummary = { version: 1, restaurantName: 'Restaurant', dishCount: 0, foodCount: 0, completeCount: 0, draftCount: 0, dishes: [] };
const input = () => ({ payload: payload(), version: 0, requestId: 'f7110000-0000-4000-8000-000000000090' });
let calls, rpcResult, publications;
beforeEach(() => {
  calls = []; rpcResult = { data: emptySummary, error: null };
  publications = [];
  globalThis.__publishOffCache = async (...args) => { assert.ok(calls.length > 0); publications.push(args); };
  globalThis.__onboardingSession = { restaurantId: 'owned-restaurant', error: null, supabase: { rpc: async (...args) => { calls.push(args); return rpcResult; } } };
});

test('new dish price supports comma decimals and genuine zero; missing price stays null', () => {
  assert.equal(newDishSchema.parse({ name: ' Suppe ', price: '' }).price, null);
  assert.equal(newDishSchema.parse({ name: 'Suppe', price: '0' }).price, 0);
  assert.equal(newDishSchema.parse({ name: 'Suppe', price: '12,50' }).price, 12.5);
  for (const price of ['-1', '1e2', '2.555']) assert.equal(newDishSchema.safeParse({ name: 'Suppe', price }).success, false);
});
test('recipes reject lost foods, duplicate ingredients, invalid portions, invalid quantity and mass/volume mixing', () => {
  const recipe = payload().recipes[key];
  assert.deepEqual(recipeErrors(recipe, [{ ...food, sourceLabel: '' }]), []);
  assert.ok(recipeErrors(recipe, []).length);
  for (const quantity of ['0', '-1', '1e2', 'Infinity', '1000001']) {
    assert.ok(recipeErrors({ ...recipe, ingredients: [{ ...recipe.ingredients[0], quantity }] }, [food]).length);
  }
  for (const servings of ['0', '1.5', 'abc']) assert.ok(recipeErrors({ ...recipe, servings }, [food]).length);
  assert.ok(recipeErrors({ ...recipe, ingredients: [...recipe.ingredients, ...recipe.ingredients] }, [food]).length);
  assert.ok(recipeErrors(recipe, [{ ...food, basis: '100ml' }]).length);
  assert.equal(onboardingPayloadSchema.safeParse({ ...payload(), recipes: { foreign: recipe } }).success, false);
});
test('empty recipes and unknown nutrition can be kept as drafts, not invented values', () => {
  const draft = payload(); draft.recipes = {};
  assert.equal(onboardingPayloadSchema.safeParse(draft).success, true);
  assert.deepEqual(recipeErrors({ servings: '1', ingredients: [] }, []), []);
});
test('save resolves restaurant, fixes one portion and preserves decimal input and caller state', async () => {
  const value = input();
  assert.equal((await finishOnboarding(value)).status, 'saved');
  assert.equal(calls[0][0], 'save_restaurant_onboarding_v2');
  assert.equal(calls[0][1].target_restaurant_id, 'owned-restaurant');
  assert.equal(calls[0][1].payload.recipes[key].servings, '1');
  assert.equal(value.payload.recipes[key].servings, '2');
  assert.equal(calls[0][1].payload.recipes[key].ingredients[0].quantity, '12.50');
  assert.equal(value.payload.recipes[key].ingredients[0].quantity, '12,50');
  assert.equal(calls[0][1].request_id, value.requestId);
});
test('invalid input, missing account and incomplete consent never invoke the save RPC', async () => {
  const bad = input(); bad.payload.manualFoods[0].noticeVersion = 'old';
  assert.equal((await finishOnboarding(bad)).status, 'error');
  globalThis.__onboardingSession.restaurantId = null;
  assert.equal((await finishOnboarding(input())).status, 'error');
  assert.equal(calls.length, 0);
});
test('OFF values are replaced by server-verified data before persistent storage', async () => {
  const value = input(); value.payload.recipes = {};
  const off = { id: 'off:3017620422003', name: 'OFF', detail: 'Test', basis: '100g', preparation: 'as_sold',
    energyKcal: 99, proteinG: null, fatG: 0, carbohydrateG: null,
    source: { kind: 'off', barcode: '3017620422003', fetchedAt: '2026-11-11T10:00:00Z', modifiedAt: null } };
  value.payload.catalogFoods = [off];
  globalThis.__offVerification = { status: 'success', foods: [{ ...off, energyKcal: 12 }], hasMore: false };
  assert.equal((await finishOnboarding(value)).status, 'saved');
  assert.equal(calls[0][1].payload.catalogFoods[0].energyKcal, 12);
  assert.equal(calls[0][1].payload.catalogFoods[0].proteinG, null);
  globalThis.__offVerification = { status: 'error', message: 'Unavailable' }; calls = [];
  assert.equal((await finishOnboarding(value)).status, 'error'); assert.equal(calls.length, 0);
});

test('only trusted fetched products are published after successful save, never on failed saves', async () => {
  const value = input(); value.payload.recipes = {};
  const off = { id: 'off:3017620422003', name: 'OFF', detail: '', basis: '100g', preparation: 'as_sold',
    energyKcal: 99, proteinG: null, fatG: 0, carbohydrateG: null,
    source: { kind: 'off', barcode: '3017620422003', fetchedAt: '2026-11-17T10:00:00Z', modifiedAt: null } };
  value.payload.catalogFoods = [off];
  const trusted = { ...off, energyKcal: 12 };
  globalThis.__offVerification = { status: 'success', foods: [trusted], hasMore: false, cacheCandidate: trusted };
  rpcResult = { data: null, error: { code: '40001' } };
  assert.equal((await finishOnboarding(value)).status, 'error');
  assert.equal(publications.length, 0);
  rpcResult = { data: emptySummary, error: null };
  assert.equal((await finishOnboarding(value)).status, 'saved');
  assert.deepEqual(publications[0], ['owned-restaurant', value.requestId, [trusted]]);
  delete globalThis.__offVerification.cacheCandidate;
  await finishOnboarding(value);
  assert.deepEqual(publications[1][2], []);
});

test('cache publication failure cannot turn a committed save into a failure', async () => {
  globalThis.__publishOffCache = async () => { throw new Error('private key'); };
  const originalWarn = console.warn;
  const messages = []; console.warn = message => messages.push(message);
  try { assert.equal((await finishOnboarding(input())).status, 'saved'); }
  finally { console.warn = originalWarn; }
  assert.equal(messages.length, 1); assert.ok(!messages[0].includes('private key'));
});
test('conflicts and RPC failures are visible without leaking provider details or clearing drafts', async () => {
  for (const code of ['40001','PGRST202','XX000']) {
    rpcResult = { data: null, error: { code, message: 'private secret' } };
    const result = await finishOnboarding(input());
    assert.equal(result.status, 'error'); assert.equal(result.message.includes('private'), false);
  }
});
test('restoration validates complete snapshots; failures are not treated as an empty saved list', async () => {
  rpcResult = { data: { version: 0, restaurantName: 'Restaurant', ...payload(), summary: null }, error: null };
  assert.equal((await readOnboarding()).snapshot.recipes[key].servings, '2');
  assert.equal(calls[0][0], 'read_restaurant_onboarding_v2');
  rpcResult = { data: null, error: { code: 'PGRST202' } };
  assert.match((await readOnboarding()).error, /noch nicht eingerichtet/);
  rpcResult = { data: { version: 1 }, error: null };
  assert.equal((await readOnboarding()).snapshot, null);
});

const baseId = 'f7110000-0000-4000-8000-000000000200';
const basisPayload = () => ({ ...payload(),
  basisRecipes: [{ id: baseId, name: 'Teig', outputQuantity: '400,50', outputUnit: 'g',
    ingredients: [{ foodId: id, quantity: '200,25', unit: 'g' }] }],
  dishBases: { [key]: [{ basisId: baseId, quantity: '80,25', unit: 'g' }] },
});

test('v2 saves basis ingredients, yield and links with stable IDs and normalized decimals', async () => {
  const value = { ...input(), payload: basisPayload() };
  const before = structuredClone(value);
  assert.equal((await finishOnboarding(value)).status, 'saved');
  const saved = calls[0][1].payload;
  assert.equal(saved.schemaVersion, 2);
  assert.equal(saved.basisRecipes[0].id, baseId);
  assert.equal(saved.basisRecipes[0].outputQuantity, '400.50');
  assert.equal(saved.basisRecipes[0].ingredients[0].quantity, '200.25');
  assert.equal(saved.dishBases[key][0].quantity, '80.25');
  assert.deepEqual(value, before);
  calls = [];
  const deletion = { ...value, payload: { ...value.payload, basisRecipes: [], dishBases: { [key]: [] }, deletedBasisIds: [baseId] } };
  assert.equal((await finishOnboarding(deletion)).status, 'saved');
  assert.deepEqual(calls[0][1].payload.deletedBasisIds, [baseId]);
  assert.deepEqual(calls[0][1].payload.dishBases[key], []);
});

test('v2 rejects old or incomplete contracts and never retries saving through v1', async () => {
  const old = input(); delete old.payload.schemaVersion;
  assert.equal((await finishOnboarding(old)).status, 'error');
  assert.equal(calls.length, 0);
  rpcResult = { data: null, error: { code: 'PGRST202' } };
  assert.equal((await finishOnboarding({ ...input(), payload: basisPayload() })).status, 'error');
  assert.deepEqual(calls.map(call => call[0]), ['save_restaurant_onboarding_v2']);
  assert.equal(publications.length, 0);
});

test('OFF verification rechecks basis ingredient units before any write', async () => {
  const value = { ...input(), payload: basisPayload() };
  const off = { id: 'off:3017620422003', name: 'OFF', detail: '', basis: '100g', preparation: 'as_sold',
    energyKcal: 99, proteinG: null, fatG: 0, carbohydrateG: null,
    source: { kind: 'off', barcode: '3017620422003', fetchedAt: '2026-11-17T10:00:00Z', modifiedAt: null } };
  value.payload.catalogFoods = [off];
  value.payload.basisRecipes[0].ingredients[0].foodId = off.id;
  globalThis.__offVerification = { status: 'success', foods: [{ ...off, basis: '100ml' }], hasMore: false };
  assert.equal((await finishOnboarding(value)).status, 'error');
  assert.equal(calls.length, 0);
  assert.equal(publications.length, 0);
});

test('v2 reads restore bases and links; invalid v2 data and permission errors never fall back', async () => {
  rpcResult = { data: { ...basisPayload(), version: 1, restaurantName: 'Test', summary: null }, error: null };
  const result = await readOnboarding();
  assert.equal(result.error, null);
  assert.equal(result.snapshot.basisRecipes[0].id, baseId);
  assert.equal(result.snapshot.dishBases[key][0].quantity, '80,25');
  for (const failure of [{ data: { version: 1 }, error: null }, { data: null, error: { code: '42501' } }]) {
    calls = []; rpcResult = failure;
    const result = await readOnboarding();
    assert.equal(result.snapshot, null); assert.ok(result.error);
    assert.deepEqual(calls.map(call => call[0]), ['read_restaurant_onboarding_v2']);
  }
});

test('missing v2 reader can display legacy data but leaves saving blocked', async () => {
  globalThis.__onboardingSession.supabase.rpc = async (name, args) => {
    calls.push([name, args]);
    return name.endsWith('_v2') ? { data: null, error: { code: 'PGRST202' } }
      : { data: { ...payload(), version: 1, restaurantName: 'Test', summary: null }, error: null };
  };
  const result = await readOnboarding();
  assert.equal(result.snapshot.restaurantName, 'Test');
  assert.match(result.error, /noch nicht eingerichtet/);
  assert.equal('schemaVersion' in result.snapshot, false);
  assert.deepEqual(calls.map(call => call[0]), ['read_restaurant_onboarding_v2', 'read_restaurant_onboarding']);
});
test('completion summary rejects inconsistent counts, partial totals, duplicates and wrong units', () => {
  const metrics = ['ENERCC','PROT625','FAT','CHO'].map(nutrient_code => ({ nutrient_code, unit: nutrient_code === 'ENERCC' ? 'kcal' : 'g', recipe_total: null, per_serving: null, status: 'incomplete' }));
  const result = { ...emptySummary, dishCount: 1, draftCount: 1, dishes: [{ key, complete: false, metrics }] };
  assert.equal(completionSummarySchema.safeParse(result).success, true);
  metrics[0].recipe_total = 0;
  assert.equal(completionSummarySchema.safeParse(result).success, false);
  metrics[0].recipe_total = null; metrics[0].unit = 'g';
  assert.equal(completionSummarySchema.safeParse(result).success, false);
  metrics[0].unit = 'kcal'; result.completeCount = 1;
  assert.equal(completionSummarySchema.safeParse(result).success, false);
});
