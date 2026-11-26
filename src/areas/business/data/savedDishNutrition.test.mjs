import assert from 'node:assert/strict';
import test from 'node:test';
import { getSavedDishNutrition, formatNutritionValue } from './savedDishNutrition.ts';

const dishId = 'manual-test-pizza';
const fixture = () => ({ dishId, version: 3, hasUnsavedChanges: false, readError: null,
  summary: { version: 3, dishes: [{ key: dishId, complete: true, metrics: [
    { nutrient_code: 'CHO', status: 'complete', recipe_total: 48, per_serving: 24 },
    { nutrient_code: 'ENERCC', status: 'complete', recipe_total: 600, per_serving: 300 },
    { nutrient_code: 'FAT', status: 'complete', recipe_total: 0, per_serving: 0 },
    { nutrient_code: 'PROT625', status: 'complete', recipe_total: 18, per_serving: 9 },
  ] }] } });

test('uses saved per-serving values in label order without recomputing or confusing batch totals', () => {
  const result = getSavedDishNutrition(fixture());
  assert.equal(result.status, 'saved');
  assert.deepEqual(result.rows.map(row => [row.code, row.value, row.unit]), [
    ['ENERCC', 300, 'kcal'], ['PROT625', 9, 'g'], ['FAT', 0, 'g'], ['CHO', 24, 'g'],
  ]);
});

test('unknown metrics stay unknown while genuine zeros remain visible', () => {
  const input = fixture(); input.summary.dishes[0].complete = false;
  Object.assign(input.summary.dishes[0].metrics[3], { status: 'incomplete', recipe_total: null, per_serving: null });
  const result = getSavedDishNutrition(input);
  assert.equal(result.rows[1].value, null); assert.equal(result.rows[2].value, 0);
  assert.match(result.message, /Entwurf/);
  assert.equal(formatNutritionValue(null), 'Nicht verfügbar');
  assert.equal(formatNutritionValue(0), '0');
  assert.equal(formatNutritionValue(0.004), '< 0,01');
  assert.equal(formatNutritionValue(12.345), '12,35');
});

test('recipe, food or shared-basis edits hide every saved number until confirmed save', () => {
  const input = fixture(); input.hasUnsavedChanges = true;
  const result = getSavedDishNutrition(input);
  assert.equal(result.status, 'pending'); assert.equal('rows' in result, false);
  input.hasUnsavedChanges = false; input.version = 4;
  assert.equal(getSavedDishNutrition(input).status, 'pending');
  input.summary.version = 4;
  assert.equal(getSavedDishNutrition(input).status, 'saved');
});

test('load failures, no summary and new dishes never masquerade as zero nutrition', () => {
  const failed = getSavedDishNutrition({ ...fixture(), readError: 'failed' });
  assert.equal(failed.status, 'error'); assert.equal('rows' in failed, false);
  for (const input of [{ ...fixture(), summary: null }, { ...fixture(), dishId: 'new-dish' }]) {
    const result = getSavedDishNutrition(input);
    assert.equal(result.status, 'unsaved'); assert.equal('rows' in result, false);
  }
});
