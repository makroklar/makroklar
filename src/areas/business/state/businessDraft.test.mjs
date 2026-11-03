import assert from 'node:assert/strict';
import test from 'node:test';
import { getItems } from '../data/lightspeedItems.ts';
import { getImportedItemKey, mergeImportedItems } from './businessDraft.ts';

test('acceptance updates an existing source item and retains other accepted items', async () => {
  const [first, second, third] = await getItems();
  const current = mergeImportedItems([], [first, second]);
  const edited = {
    ...first,
    name: 'Bearbeitetes Schnitzel',
    prices: [{ name: 'Standard', amount: 26.5 }],
  };
  const next = mergeImportedItems(current, [edited, third]);
  assert.equal(next.length, 3);
  const updated = next.find(item => item.sourceId === first.sourceId);
  assert.equal(updated.name, edited.name);
  assert.equal(updated.prices[0].amount, 26.5);
  assert.equal(updated.sku, first.sku);
  assert.equal(current[0].name, first.name);
  assert.equal(current[0].prices[0].amount, first.prices[0].amount);
  assert.deepEqual(next.map(getImportedItemKey), [first, second, third].map(getImportedItemKey));
});

test('the draft owns copies of incoming prices and accounting groups', async () => {
  const [incoming] = await getItems();
  const accepted = mergeImportedItems([], [incoming]);
  incoming.name = 'Noch nicht übernommen';
  incoming.prices[0].amount = 1;
  incoming.accountingGroup.name = 'Nur lokale Änderung';
  assert.notEqual(accepted[0].name, incoming.name);
  assert.notEqual(accepted[0].prices[0].amount, incoming.prices[0].amount);
  assert.notEqual(accepted[0].accountingGroup.name, incoming.accountingGroup.name);
});

test('loading the catalog restores accepted edits without changing the fixture', async () => {
  const catalog = await getItems();
  const accepted = mergeImportedItems([], [{
    ...catalog[0],
    name: 'Übernommener Artikelname',
    prices: [{ name: 'Standard', amount: 27.9 }],
  }]);
  const restored = mergeImportedItems(await getItems(), accepted);
  assert.equal(restored.length, 70);
  assert.equal(new Set(restored.map(getImportedItemKey)).size, 70);
  assert.equal(restored[0].name, accepted[0].name);
  assert.equal(restored[0].prices[0].amount, 27.9);
  assert.deepEqual(restored[1], catalog[1]);
  restored[0].prices[0].amount = 1;
  assert.equal(accepted[0].prices[0].amount, 27.9);
  assert.equal((await getItems())[0].name, catalog[0].name);
});

test('price choices and original identity survive acceptance and restoration', async () => {
  const [item] = await getItems();
  const accepted = mergeImportedItems([], [{
    ...item,
    prices: [{name:'Standard', amount:24.9}, {name:'Mittag', amount:19.9}],
    selectedPriceIndex: 1,
  }]);
  const restored = mergeImportedItems([item], accepted)[0];
  assert.equal(restored.sourceId, item.sourceId);
  assert.equal(restored.selectedPriceIndex, 1);
  assert.equal(restored.prices[restored.selectedPriceIndex].amount, 19.9);
});
