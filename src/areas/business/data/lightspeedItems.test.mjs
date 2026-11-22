import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getItems, mapLightspeedItem } from './lightspeedItems.ts';

const fixtures = JSON.parse(
  await readFile(new URL('../mocks/lightspeed-items.json', import.meta.url), 'utf8'),
);

test('the local fixture collection contains 70 stable, unique items', () => {
  assert.equal(fixtures.length, 70);
  assert.equal(new Set(fixtures.map((item) => item.id)).size, 70);
  assert.equal(new Set(fixtures.map((item) => item.sku)).size, 70);
  const groups = new Map();
  for (const item of fixtures) {
    assert.ok(Number.isSafeInteger(item.id));
    assert.ok(item.sku.length >= 1 && item.sku.length <= 32);
    assert.equal(item.priceMode, 'AMOUNT');
    assert.equal(item.prices.length, 1);
    assert.equal(item.prices[0].name, 'Standard');
    assert.ok(item.prices[0].amount > 0);
    assert.equal('price' in item, false);
    if (groups.has(item.accountingGroup.id)) {
      assert.equal(groups.get(item.accountingGroup.id), item.accountingGroup.name);
    }
    groups.set(item.accountingGroup.id, item.accountingGroup.name);
  }
  assert.equal(groups.size, 5);
  assert.equal(new Set(groups.values()).size, 5);
});

test('getItems preserves source identity and returns independent draft data', async () => {
  const first = await getItems();
  assert.equal(first.length, 70);
  assert.equal(first[0].sourceId, fixtures[0].id);
  assert.equal(first[0].sku, fixtures[0].sku);
  assert.equal(first[0].source, 'lightspeed-k-series');
  assert.equal(first[0].selectedPriceIndex, 0);
  first[0].name = 'Temporäre Änderung';
  first[0].prices[0].amount = 1;
  first[0].accountingGroup.name = 'Temporäre Gruppe';
  const second = await getItems();
  assert.equal(second[0].name, fixtures[0].name);
  assert.equal(second[0].prices[0].amount, fixtures[0].prices[0].amount);
  assert.equal(second[0].accountingGroup.name, fixtures[0].accountingGroup.name);
});

test('multiple prices remain available without an arbitrary default', () => {
  const source = {
    ...fixtures[0],
    prices: [
      { name: 'Standard', amount: 24.9 },
      { name: 'Mittag', amount: 19.9 },
    ],
  };
  const item = mapLightspeedItem(source);
  assert.equal(item.selectedPriceIndex, null);
  assert.deepEqual(item.prices, source.prices);
  assert.notEqual(item.prices[0], source.prices[0]);
});

test('missing prices stay unset; percentages and unsafe IDs are not guessed', () => {
  const noPrice = mapLightspeedItem({ ...fixtures[0], prices: [] });
  assert.equal(noPrice.selectedPriceIndex, null);
  assert.deepEqual(noPrice.prices, []);
  assert.throws(
    () => mapLightspeedItem({ ...fixtures[0], priceMode: 'PERCENT' }),
    /AMOUNT/,
  );
  assert.throws(
    () => mapLightspeedItem({ ...fixtures[0], id: Number.MAX_SAFE_INTEGER + 1 }),
    /ID/,
  );
  assert.throws(
    () => mapLightspeedItem({ ...fixtures[0], prices: [{ name: 'Standard', amount: NaN }] }),
    /Festpreis/,
  );
});
