import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { beforeEach } from 'node:test';
import { acceptedMenuItemsSchema, fromStoredDish, toImportPayload } from './menuStorageModel.ts';

const serverMock = 'data:text/javascript,' + encodeURIComponent(
  'export const createClient = async () => globalThis.__menuClient;',
);
const cacheMock = 'data:text/javascript,' + encodeURIComponent(
  'export const revalidatePath = (...args) => globalThis.__menuRevalidate(...args);',
);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/shared/supabase/server') return { url: serverMock, shortCircuit: true };
    if (specifier === 'next/cache') return { url: cacheMock, shortCircuit: true };
    if (['./menuStorageModel', './savedMenu'].includes(specifier)) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  },
});
const { readSavedMenu } = await import('./savedMenu.ts');
const { saveMenuItems } = await import('./saveMenuAction.ts');

const accountId = '11111111-1111-4111-8111-111111111111';
const restaurantId = '22222222-2222-4222-8222-222222222222';
const otherRestaurant = '33333333-3333-4333-8333-333333333333';
const dishId = '44444444-4444-4444-8444-444444444444';
function item(id = 101) {
  return {
    source: 'lightspeed-k-series', sourceId: id, sku: `DEMO-${id}`, name: 'Kartoffelsuppe',
    accountingGroup: { sourceId: 7, name: 'Vorspeisen' },
    prices: [{ name: 'Standard', amount: 7.5 }, { name: 'Mittag', amount: 6.25 }],
    selectedPriceIndex: 1,
  };
}
function row(id = 101) {
  return {
    id: dishId, restaurant_id: restaurantId, source: 'lightspeed-k-series', source_id: String(id),
    name: 'Kartoffelsuppe', dish_import_details: [{
      dish_id: dishId, restaurant_id: restaurantId, sku: `DEMO-${id}`,
      accounting_group_source_id: '7', accounting_group_name: 'Vorspeisen',
      prices: item().prices, selected_price_index: 1, currency: 'EUR',
    }],
  };
}

let state;
beforeEach(() => {
  state = {
    user: { id: accountId }, authError: null,
    members: [{ restaurant_id: restaurantId }], memberError: null,
    pages: [[row()]], readErrorPage: -1, calls: [], rpcCalls: [],
    rpcError: null, rpcThrows: false, rpcCount: null, invalidations: [],
  };
  globalThis.__menuRevalidate = (...args) => state.invalidations.push(args);
  globalThis.__menuClient = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: state.authError }) },
    from(table) {
      const call = { table, filters: [], orders: [] };
      state.calls.push(call);
      const query = {
        select(value) { call.select = value; return query; },
        eq(key, value) { call.filters.push([key, value]); return query; },
        order(key) { call.orders.push(key); return query; },
        async limit(value) {
          call.limit = value;
          return { data: state.members, error: state.memberError };
        },
        async range(start, end) {
          call.range = [start, end];
          const page = start / 500;
          return { data: state.pages[page] ?? [], error: page === state.readErrorPage ? { message: 'private db error' } : null };
        },
      };
      return query;
    },
    async rpc(name, payload) {
      state.rpcCalls.push({ name, payload });
      if (state.rpcThrows) throw new Error('private provider error');
      return { data: state.rpcCount ?? payload.imported_items.length, error: state.rpcError };
    },
  };
});

test('reviewed selections round-trip all prices, their explicit choice and original identities', () => {
  const parsed = acceptedMenuItemsSchema.parse([item()]);
  const payload = toImportPayload(parsed);
  assert.deepEqual(payload, [{
    source_id: '101', sku: 'DEMO-101', name: 'Kartoffelsuppe',
    accounting_group_source_id: '7', accounting_group_name: 'Vorspeisen',
    prices: item().prices, selected_price_index: 1, currency: 'EUR',
  }]);
  assert.deepEqual(fromStoredDish(row(), restaurantId), item());
  payload[0].prices[0].amount = 99;
  assert.equal(parsed[0].prices[0].amount, 7.5);
});

test('missing accounting groups and a genuine zero price survive storage', () => {
  const selected = { ...item(), accountingGroup: null, prices: [{ name: 'Standard', amount: 0 }], selectedPriceIndex: 0 };
  assert.equal(acceptedMenuItemsSchema.safeParse([selected]).success, true);
  const stored = row();
  Object.assign(stored.dish_import_details[0], {
    accounting_group_source_id: null, accounting_group_name: null,
    prices: selected.prices, selected_price_index: 0,
  });
  assert.deepEqual(fromStoredDish(stored, restaurantId), selected);
});

test('invalid or ambiguous selections are rejected before Auth or an RPC call', async () => {
  const invalid = [[], [item(), item()], [{ ...item(), sourceId: Number.MAX_SAFE_INTEGER + 1 }],
    [{ ...item(), name: ' ' }], [{ ...item(), sku: '' }], [{ ...item(), source: 'other' }],
    [{ ...item(), restaurantId: otherRestaurant }], [{ ...item(), selectedPriceIndex: null }],
    [{ ...item(), selectedPriceIndex: 2 }], [{ ...item(), selectedPriceIndex: -1 }],
    [{ ...item(), selectedPriceIndex: 0.5 }], [{ ...item(), prices: [] }],
    ...[-1, 1.234, Infinity, NaN, '7.5'].map(amount => [{ ...item(), prices: [{ name: 'Standard', amount }] }]),
    [{ ...item(), prices: [{ name: 'Standard', amount: 2, extra: 'ignored?' }] }]];
  globalThis.__menuClient.auth.getUser = () => { throw new Error('Auth must not run'); };
  for (const value of invalid) assert.equal((await saveMenuItems(value)).status, 'error');
  assert.equal(state.rpcCalls.length, 0);
  assert.equal(state.invalidations.length, 0);
});

test('stored composite relationships can be an object or exactly one array entry', () => {
  const stored = row();
  stored.dish_import_details = stored.dish_import_details[0];
  assert.deepEqual(fromStoredDish(stored, restaurantId), item());
  for (const relation of [null, [], [row().dish_import_details[0], row().dish_import_details[0]]]) {
    assert.throws(() => fromStoredDish({ ...row(), dish_import_details: relation }, restaurantId));
  }
});

test('malformed or foreign stored data never becomes a guessed menu item', () => {
  const cases = [
    { ...row(), restaurant_id: otherRestaurant },
    { ...row(), source_id: '9007199254740993' },
    { ...row(), source_id: '00101' },
    { ...row(), source_id: '1.5' },
    ...[
      { restaurant_id: otherRestaurant }, { dish_id: accountId }, { currency: 'USD' },
      { selected_price_index: 2 }, { accounting_group_source_id: 'unsafe-id' },
      { prices: [{ name: 'Standard', amount: 1.234 }] },
    ].map(change => ({ ...row(), dish_import_details: [{ ...row().dish_import_details[0], ...change }] })),
  ];
  for (const value of cases) assert.throws(() => fromStoredDish(value, restaurantId));
});

test('anonymous snapshots are empty without querying restaurant data', async () => {
  state.user = null;
  state.authError = { name: 'AuthSessionMissingError' };
  assert.deepEqual(await readSavedMenu(), { accountKey: 'anonymous', restaurantId: null, items: [], error: null });
  assert.equal(state.calls.length, 0);
  assert.equal((await saveMenuItems([item()])).status, 'error');
  assert.equal(state.rpcCalls.length, 0);
});

test('Auth outages and forged sessions cannot save or read a tenant', async () => {
  state.user = null;
  for (const authError of [{ status: 503 }, { code: 'bad_jwt', status: 401 }]) {
    state.authError = authError;
    const snapshot = await readSavedMenu();
    assert.equal(snapshot.items.length, 0);
    if (authError.status === 503) assert.ok(snapshot.error);
    assert.equal((await saveMenuItems([item()])).status, 'error');
  }
  assert.equal(state.calls.length, 0);
  assert.equal(state.rpcCalls.length, 0);
});

test('zero or multiple owned restaurants require explicit resolution without choosing one', async () => {
  for (const members of [[], [{ restaurant_id: restaurantId }, { restaurant_id: otherRestaurant }]]) {
    state.members = members;
    const snapshot = await readSavedMenu();
    assert.equal(snapshot.restaurantId, null);
    assert.ok(snapshot.error);
    assert.equal((await saveMenuItems([item()])).status, 'error');
  }
  assert.equal(state.rpcCalls.length, 0);
  assert.equal(state.calls.some(call => call.table === 'dishes'), false);
});

test('membership read failures block import and return a neutral error', async () => {
  state.memberError = { message: 'private schema details' };
  assert.ok((await readSavedMenu()).error);
  const result = await saveMenuItems([item()]);
  assert.equal(result.status, 'error');
  assert.equal(result.message.includes('private'), false);
  assert.equal(state.rpcCalls.length, 0);
});

test('restoration is scoped to the verified account and restaurant', async () => {
  const snapshot = await readSavedMenu();
  assert.deepEqual(snapshot, { accountKey: accountId, restaurantId, items: [item()], error: null });
  assert.deepEqual(state.calls[0].filters, [['user_id', accountId], ['role', 'owner']]);
  assert.equal(state.calls[0].limit, 2);
  assert.deepEqual(state.calls[1].filters, [['restaurant_id', restaurantId], ['source', 'lightspeed-k-series']]);
  assert.deepEqual(state.calls[1].orders, ['created_at', 'id']);
});

test('restoration paginates beyond the API row limit', async () => {
  state.pages = [Array.from({ length: 500 }, (_, i) => row(i + 1)), [row(501)]];
  const snapshot = await readSavedMenu();
  assert.equal(snapshot.error, null);
  assert.equal(snapshot.items.length, 501);
  assert.deepEqual(state.calls.filter(call => call.table === 'dishes').map(call => call.range), [[0, 499], [500, 999]]);
});

test('a later page failure never presents a partial menu as a complete snapshot', async () => {
  state.pages = [Array.from({ length: 500 }, (_, i) => row(i + 1))];
  state.readErrorPage = 1;
  const snapshot = await readSavedMenu();
  assert.equal(snapshot.items.length, 0);
  assert.ok(snapshot.error);
});

test('malformed or duplicate stored identities fail restoration visibly', async () => {
  for (const page of [[{ ...row(), source_id: 'unknown' }], [row(), row()]]) {
    state.pages = [page];
    const snapshot = await readSavedMenu();
    assert.equal(snapshot.items.length, 0);
    assert.ok(snapshot.error);
  }
});

test('an empty stored menu is a successful snapshot and later reads are not shared across accounts', async () => {
  await readSavedMenu();
  state.pages = [[]];
  state.user = { id: otherRestaurant };
  const snapshot = await readSavedMenu();
  assert.equal(snapshot.accountKey, otherRestaurant);
  assert.equal(snapshot.error, null);
  assert.deepEqual(snapshot.items, []);
});

test('saving sends a validated batch to the server-resolved restaurant and invalidates the business layout', async () => {
  const selected = [{ ...item(), name: '  Neue Suppe  ' }, item(102)];
  const result = await saveMenuItems(selected);
  assert.equal(result.status, 'saved');
  assert.equal(result.items[0].name, 'Neue Suppe');
  assert.equal(state.rpcCalls.length, 1);
  assert.deepEqual(state.rpcCalls[0], {
    name: 'import_lightspeed_items', payload: {
      target_restaurant_id: restaurantId, imported_items: toImportPayload(result.items),
    },
  });
  assert.deepEqual(state.invalidations, [['/business', 'layout']]);
});

test('RPC errors, exceptions and unconfirmed counts never produce success or cache invalidation', async () => {
  for (const change of [{ rpcError: { message: 'private database detail' } }, { rpcThrows: true }, { rpcCount: 0 }]) {
    Object.assign(state, { rpcError: null, rpcThrows: false, rpcCount: null }, change);
    const result = await saveMenuItems([item()]);
    assert.equal(result.status, 'error');
    assert.equal(result.message.includes('private'), false);
    assert.equal('items' in result, false);
  }
  assert.equal(state.invalidations.length, 0);
});

test('a committed import remains successful if cache invalidation fails afterward', async () => {
  globalThis.__menuRevalidate = () => { throw new Error('cache unavailable'); };
  assert.equal((await saveMenuItems([item()])).status, 'saved');
  assert.equal(state.rpcCalls.length, 1);
});
