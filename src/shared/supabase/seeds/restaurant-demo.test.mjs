import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { checkTarget, existingPilotState, mergePilot, calculateRecipe, recipeKey } from './seed-restaurant-demo.mjs';

const manifest = JSON.parse(await readFile(new URL('./restaurant-demo-pilot.json', import.meta.url), 'utf8'));
// Synthetic numbers for unit tests only. The actual seed resolves all values from SQL.
const resolved = Object.fromEntries(Object.entries(manifest.foods).map(([alias, source]) => [alias, {
  id: source.kind === 'off' ? `off:${source.barcode}` : `bls:${manifest.datasetId}:${source.code}`,
  name: source.name, detail: 'Unit-test fixture', basis: '100g', preparation: 'as_sold',
  energyKcal: 100, proteinG: 10, fatG: 2, carbohydrateG: 20,
  source: source.kind === 'off' ? { kind: 'off', barcode: source.barcode, fetchedAt: '2026-11-17T13:30:53.104Z', modifiedAt: null }
    : { kind: 'bls', datasetId: manifest.datasetId, code: source.code, version: manifest.datasetVersion },
}]));
const empty = () => ({ customDishes: [], catalogFoods: [], manualFoods: [], recipes: {} });

test('pilot is limited to the approved project and three explicitly approved restaurants', () => {
  assert.equal(checkTarget(manifest, manifest.restaurantId, manifest.projectRef), 'Dönerladen');
  assert.equal(checkTarget(manifest, '52bddc5a-2efc-4915-853f-b665dffaef2c', manifest.projectRef), 'PizzaLaden');
  assert.equal(checkTarget(manifest, '55727717-68c6-404e-a0a7-7db1b1653f41', manifest.projectRef), 'test-max');
  assert.throws(() => checkTarget(manifest, '00000000-0000-4000-8000-000000000001', manifest.projectRef), /approved/);
  assert.throws(() => checkTarget(manifest, 'toString', manifest.projectRef), /approved/);
  assert.throws(() => checkTarget(manifest, manifest.restaurantId, 'other-project'), /project/);
  assert.throws(() => checkTarget(manifest, undefined, manifest.projectRef));
});

test('three explicit demo recipes combine BLS and OFF without stored totals or invented manual consent', () => {
  const payload = mergePilot(empty(), [], manifest, resolved);
  assert.equal(payload.customDishes.length, 3);
  assert.equal(payload.manualFoods.length, 0);
  assert.ok(payload.customDishes.every(dish => dish.name.startsWith('Demo · ')));
  const dessert = payload.recipes[recipeKey(manifest.dishes[2].id)];
  assert.equal(dessert.servings, '1');
  assert.ok(dessert.ingredients.some(line => line.foodId.startsWith('off:')));
  assert.ok(dessert.ingredients.some(line => line.foodId.startsWith('bls:')));
  assert.equal('energyKcal' in payload.customDishes[0], false);
  assert.equal(new Set(payload.catalogFoods.map(food => food.id)).size, payload.catalogFoods.length);
});

test('merging is immutable and keeps all existing dishes, recipes and accepted food values', () => {
  const state = empty();
  state.customDishes.push({ id: 'de202611-1124-4000-8000-000000000099', name: 'Existing', price: 4 });
  state.catalogFoods.push({ ...resolved.skyr, energyKcal: 75 });
  state.recipes['lightspeed-k-series-42'] = { servings: '1', ingredients: [{ foodId: resolved.skyr.id, quantity: '200', unit: 'g' }] };
  const before = structuredClone(state);
  const result = mergePilot(state, [42], manifest, resolved);
  assert.deepEqual(state, before);
  assert.deepEqual(result.importedIds, [42]);
  assert.deepEqual(result.customDishes[0], before.customDishes[0]);
  assert.deepEqual(result.recipes['lightspeed-k-series-42'], before.recipes['lightspeed-k-series-42']);
  assert.equal(result.catalogFoods.find(food => food.id === resolved.skyr.id).energyKcal, 75);
});

test('repeated seeding preserves edited demo dishes; partial sets require manual review', () => {
  const state = empty();
  state.customDishes = manifest.dishes.map(dish => ({ id: dish.id, name: 'Edited by owner', price: 1 }));
  assert.equal(existingPilotState(state, manifest), 'already_present');
  assert.throws(() => mergePilot(state, [], manifest, resolved), /preserve user edits/);
  state.customDishes.pop();
  assert.throws(() => existingPilotState(state, manifest), /Partial/);
});

test('arithmetic reflects additions, deletions and changed quantities without rounding ingredients', () => {
  const foods = [resolved.rice, { ...resolved.oil, energyKcal: 899, fatG: 99.9, proteinG: 0, carbohydrateG: 0 }];
  const rice = { foodId: resolved.rice.id, quantity: '150', unit: 'g' };
  const oil = { foodId: resolved.oil.id, quantity: '10', unit: 'g' };
  const baseline = calculateRecipe({ ingredients: [rice] }, foods);
  const doubled = calculateRecipe({ ingredients: [{ ...rice, quantity: '300' }] }, foods);
  const added = calculateRecipe({ ingredients: [rice, oil] }, foods);
  assert.equal(baseline.ENERCC, 150);
  assert.equal(doubled.ENERCC, baseline.ENERCC * 2);
  assert.equal(added.ENERCC, baseline.ENERCC + 89.9);
  assert.deepEqual(calculateRecipe({ ingredients: [rice] }, foods), baseline);
  const zero = calculateRecipe({ ingredients: [oil] }, foods);
  assert.equal(zero.PROT625, 0);
});

test('unknown nutrients, invalid quantities and implicit g/ml conversion are rejected', () => {
  const line = { foodId: resolved.rice.id, quantity: '100', unit: 'g' };
  assert.throws(() => calculateRecipe({ ingredients: [line] }, [{ ...resolved.rice, proteinG: null }]), /complete/);
  assert.throws(() => calculateRecipe({ ingredients: [{ ...line, unit: 'ml' }] }, [resolved.rice]), /basis/);
  for (const quantity of ['0','-1','invalid']) assert.throws(() => calculateRecipe({ ingredients: [{ ...line, quantity }] }, [resolved.rice]));
  const volumeFood = { ...resolved.rice, basis: '100ml' };
  assert.equal(calculateRecipe({ ingredients: [{ ...line, unit: 'ml', quantity: '250' }] }, [volumeFood]).ENERCC, 250);
});
