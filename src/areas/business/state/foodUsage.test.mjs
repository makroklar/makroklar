import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFoodUsageIndex, removeUnusedFood } from './foodUsage.ts';

const foodId = 'manual-flour';
const line = (id = foodId) => ({ foodId: id, quantity: '', unit: 'g' });
const fixture = () => ({
  importedItems: [{ source: 'lightspeed-k-series', sourceId: 42, name: 'Pizza' }],
  customDishes: [{ id: 'custom-pizza', name: 'Pizza' }],
  recipes: {
    'lightspeed-k-series-42': { servings: '1', ingredients: [line(), line()] },
    'manual-custom-pizza': { servings: '1', ingredients: [line()] },
  },
  basisRecipes: [{ id: 'dough', name: 'Pizzateig', ingredients: [line(), line('off:12345678')] }],
});

test('shows each direct dish and basis once, identifies equal names by ID, and includes unfinished lines', () => {
  const usages = buildFoodUsageIndex(fixture());
  assert.deepEqual(usages.get(foodId), [
    { kind: 'dish', id: 'lightspeed-k-series-42', name: 'Pizza' },
    { kind: 'dish', id: 'manual-custom-pizza', name: 'Pizza' },
    { kind: 'basis', id: 'dough', name: 'Pizzateig' },
  ]);
  assert.deepEqual(usages.get('off:12345678'), [{ kind: 'basis', id: 'dough', name: 'Pizzateig' }]);
});

test('blocked removal retains the array and data for manual, OFF and BLS foods', () => {
  for (const id of [foodId, 'off:12345678', 'bls:dataset:code']) {
    const input = fixture(); input.basisRecipes[0].ingredients = [line(id)];
    const foods = [{ id, name: 'Food' }, { id: 'unused', name: 'Other' }];
    const before = structuredClone(foods);
    assert.strictEqual(removeUnusedFood(foods, id, buildFoodUsageIndex(input), true), foods);
    assert.deepEqual(foods, before);
  }
});

test('only removing every direct reference unlocks deletion; keeping the basis blocks it', () => {
  const input = fixture(); const foods = [{ id: foodId }, { id: 'unused' }];
  input.recipes = {};
  assert.strictEqual(removeUnusedFood(foods, foodId, buildFoodUsageIndex(input), true), foods);
  input.basisRecipes[0].ingredients = [];
  const removed = removeUnusedFood(foods, foodId, buildFoodUsageIndex(input), true);
  assert.deepEqual(removed, [{ id: 'unused' }]); assert.equal(foods.length, 2);
});

test('missing dish labels never bypass the guard and renamed bases use the current label', () => {
  const input = fixture(); input.importedItems = []; input.customDishes = [];
  input.basisRecipes[0].name = 'Neuer Teig';
  const usages = buildFoodUsageIndex(input);
  assert.equal(usages.get(foodId).length, 3);
  assert.match(usages.get(foodId)[0].name, /lightspeed-k-series-42/);
  assert.equal(usages.get(foodId)[2].name, 'Neuer Teig');
});

test('unconfirmed reads prevent removing even unused foods; missing IDs do not dirty state', () => {
  const foods = [{ id: 'unused' }]; const usages = new Map();
  assert.strictEqual(removeUnusedFood(foods, 'unused', usages, false), foods);
  assert.strictEqual(removeUnusedFood(foods, 'missing', usages, true), foods);
  assert.deepEqual(removeUnusedFood(foods, 'unused', usages, true), []);
});
