import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { beforeEach } from 'node:test';

const moduleFor = code => ({ url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === './savedMenu') return moduleFor('export const getMenuSession = async () => globalThis.__onboardingSession;');
  if (specifier === './offProducts') return moduleFor('export const getOffProduct = async () => globalThis.__offVerification;');
  if (specifier === 'next/cache') return moduleFor('export const revalidatePath = () => {};');
  if (['./onboardingModel','./foodSearchModel','./recipeDraft'].includes(specifier)) return next(specifier + '.ts', context);
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
const payload = () => ({ importedIds: [], customDishes: [{ id: dishId, name: 'Suppe', price: null }], manualFoods: [{ ...food }], catalogFoods: [],
  recipes: { [key]: { servings: '2', ingredients: [{ foodId: id, quantity: '12,50', unit: 'g' }] } } });
const emptySummary = { version: 1, restaurantName: 'Restaurant', dishCount: 0, foodCount: 0, completeCount: 0, draftCount: 0, dishes: [] };
const input = () => ({ payload: payload(), version: 0, requestId: 'f7110000-0000-4000-8000-000000000090' });
let calls, rpcResult;
beforeEach(() => {
  calls = []; rpcResult = { data: emptySummary, error: null };
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
  assert.equal(calls[0][0], 'save_restaurant_onboarding');
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
  rpcResult = { data: null, error: { code: 'PGRST202' } };
  assert.match((await readOnboarding()).error, /noch nicht eingerichtet/);
  rpcResult = { data: { version: 1 }, error: null };
  assert.equal((await readOnboarding()).snapshot, null);
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
