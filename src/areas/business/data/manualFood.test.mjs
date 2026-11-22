import assert from 'node:assert/strict';
import test from 'node:test';
import { validateManualFood } from './manualFood.ts';

function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: '  Testprodukt  ', basis: '100g', preparation: 'as_sold',
    sourceKind: 'supplier', sourceDescription: '  Testdatenblatt  ',
    energyKcal: '100', proteinG: '5,25', fatG: '2.5', carbohydrateG: '0',
    consent: 'on',
    ...overrides,
  })) data.set(key, value);
  return data;
}

test('manual nutrition retains decimal precision, zero, basis and provenance', () => {
  assert.deepEqual(validateManualFood(form()), {
    success: true,
    food: {
      name: 'Testprodukt', basis: '100g', preparation: 'as_sold',
      sourceKind: 'supplier', sourceDescription: 'Testdatenblatt',
      energyKcal: 100, proteinG: 5.25, fatG: 2.5, carbohydrateG: 0,
    },
  });
});

test('adding a manual food requires explicit consent with the submitted values', () => {
  const data = form();
  data.delete('consent');
  const missing = validateManualFood(data);
  assert.equal(missing.success, false);
  assert.ok(missing.errors.consent);
  for (const value of ['', 'off', 'false', new Blob(['on'])]) {
    assert.equal(validateManualFood(form({ consent: value })).success, false);
  }
  const accepted = validateManualFood(form());
  assert.equal(accepted.success, true);
  assert.equal('consent' in accepted.food, false);
});

test('missing nutrient values never become numeric zero', () => {
  for (const field of ['energyKcal', 'proteinG', 'fatG', 'carbohydrateG']) {
    for (const value of ['', '   ']) {
      const result = validateManualFood(form({ [field]: value }));
      assert.equal(result.success, false);
      assert.ok(result.errors[field]);
    }
    const data = form();
    data.delete(field);
    assert.equal(validateManualFood(data).success, false);
  }
});

test('negative, nonfinite, grouped, ambiguous and nonnumeric values are rejected', () => {
  for (const value of ['-1', 'Infinity', 'NaN', '1e3', '1,2.3', '1 000', '12 g', '0x10', '9'.repeat(400)]) {
    const result = validateManualFood(form({ proteinG: value }));
    assert.equal(result.success, false, value);
    assert.ok(result.errors.proteinG);
  }
});

test('name, source, basis and preparation must be explicitly supplied', () => {
  for (const [field, value] of [
    ['name', ' '], ['sourceDescription', ' '], ['sourceKind', 'guess'],
    ['basis', ''], ['basis', 'serving'], ['preparation', ''], ['preparation', 'unknown'],
  ]) {
    const result = validateManualFood(form({ [field]: value }));
    assert.equal(result.success, false);
    assert.ok(result.errors[field]);
  }
});

test('liquid and prepared values retain their original basis without grams conversion', () => {
  const result = validateManualFood(form({ basis: '100ml', preparation: 'prepared', sourceKind: 'label', fatG: '0,125' }));
  assert.equal(result.success, true);
  assert.equal(result.food.basis, '100ml');
  assert.equal(result.food.preparation, 'prepared');
  assert.equal(result.food.sourceKind, 'label');
  assert.equal(result.food.fatG, 0.125);
});

test('file inputs cannot bypass text validation and extra identity fields are not copied', () => {
  const data = form({ name: new Blob(['Test']), restaurantId: 'foreign', noticeVersion: 'forged' });
  assert.equal(validateManualFood(data).success, false);
  data.set('name', 'Test');
  const result = validateManualFood(data);
  assert.equal(result.success, true);
  assert.equal('restaurantId' in result.food, false);
  assert.equal('noticeVersion' in result.food, false);
});
