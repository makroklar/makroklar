import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === '../data/foodSearchModel') return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { createFoodSearch } = await import('./foodSearch.ts');

const success = { status: 'success', foods: [], hasMore: false };
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup(t, lookup = async () => success) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const calls = [], states = [];
  const search = createFoodSearch(query => { calls.push(query); return lookup(query); }, state => states.push(state));
  t.after(() => search.dispose());
  return { search, calls, states, latest: () => states.at(-1) };
}

test('typing waits for three letters and restarts the full 500ms delay on each change', async t => {
  const { search, calls, latest } = setup(t);
  for (const query of ['A', 'Ap']) {
    search.change(query); t.mock.timers.tick(1000); await flush();
  }
  assert.deepEqual(calls, []);
  search.change('Apf'); t.mock.timers.tick(499); await flush();
  assert.deepEqual(calls, []);
  search.change('Apfel'); t.mock.timers.tick(499); await flush();
  assert.deepEqual(calls, []);
  t.mock.timers.tick(1); await flush();
  assert.deepEqual(calls, ['Apfel']); assert.equal(latest().searched, 'Apfel');
});

test('numeric, partial and complete barcodes never trigger automatic calls; Enter still works', async t => {
  const { search, calls } = setup(t);
  for (const query of ['123', '301762042200', '3017620422003', '3017 6204 22003', '034-000-470693', '   ', '%%%']) {
    search.change(query); t.mock.timers.tick(1000); await flush();
  }
  assert.deepEqual(calls, []);
  await search.submit('034-000-470693');
  assert.deepEqual(calls, ['0034000470693']);
});

test('Enter cancels the scheduled automatic search and keeps two-letter manual names supported', async t => {
  const { search, calls } = setup(t);
  search.change('Apfel'); t.mock.timers.tick(200);
  await search.submit('Apfel');
  t.mock.timers.tick(1000); await flush();
  assert.deepEqual(calls, ['Apfel']);
  await search.submit('Ei'); assert.deepEqual(calls, ['Apfel', 'Ei']);
});

test('duplicate submissions share an in-flight request even after automatic search has started', async t => {
  const pending = deferred();
  const { search, calls, states } = setup(t, () => pending.promise);
  search.change('Apfel'); t.mock.timers.tick(500); await flush();
  const first = search.submit('Apfel'); const second = search.submit(' APFEL ');
  await flush(); assert.deepEqual(calls, ['Apfel']);
  pending.resolve(success); await Promise.all([first, second]);
  assert.equal(states.filter(state => state.result !== null).length, 1);
  assert.equal(states.at(-1).searched, 'APFEL');
});

test('an older response cannot replace newer results, but remains available in the query cache', async t => {
  const apple = deferred(), pear = deferred();
  const pearResult = { ...success, hasMore: true };
  const { search, latest, calls } = setup(t, query => query === 'Apfel' ? apple.promise : pear.promise);
  search.change('Apfel'); t.mock.timers.tick(500); await flush();
  search.change('Birne'); t.mock.timers.tick(500); await flush();
  pear.resolve(pearResult); await flush();
  assert.equal(latest().searched, 'Birne'); assert.equal(latest().result, pearResult);
  apple.resolve(success); await flush();
  assert.equal(latest().searched, 'Birne'); assert.equal(latest().result, pearResult);
  await search.submit('Apfel');
  assert.equal(latest().result, success); assert.deepEqual(calls, ['Apfel', 'Birne']);
});

test('clearing or shortening the input immediately hides results and invalidates a late response', async t => {
  const pending = deferred();
  const { search, latest } = setup(t, () => pending.promise);
  search.change('Apfel'); t.mock.timers.tick(500); await flush();
  assert.equal(latest().pending, true);
  search.change('Ap');
  assert.deepEqual(latest(), { searched: '', result: null, pending: false });
  pending.resolve(success); await flush();
  assert.equal(latest().result, null);
  await search.submit('Apfel'); assert.equal(latest().result, success);
  search.change(''); assert.equal(latest().result, null);
});

test('a failed obsolete request cannot replace the current results with an error', async t => {
  const old = deferred();
  const { search, latest } = setup(t, query => query === 'Apfel' ? old.promise : Promise.resolve(success));
  const first = search.submit('Apfel'); await flush();
  await search.submit('Birne'); old.reject(new Error('private detail')); await first;
  assert.equal(latest().searched, 'Birne'); assert.equal(latest().result, success);
});

test('successful results are reused for five minutes across explicit and automatic searches', async t => {
  const { search, calls } = setup(t);
  await search.submit('Apfel');
  search.change(' APFEL '); t.mock.timers.tick(500); await flush();
  assert.equal(calls.length, 1);
  t.mock.timers.tick(299_499); await search.submit('apfel');
  assert.equal(calls.length, 1);
  t.mock.timers.tick(1); await search.submit('Apfel');
  assert.equal(calls.length, 2);
});

test('errors are not cached and rejected requests offer safe retry feedback', async t => {
  let attempts = 0;
  const { search, latest, calls } = setup(t, async () => {
    if (attempts++ === 0) throw new Error('private detail');
    if (attempts === 2) return { status: 'error', message: 'Try again' };
    return success;
  });
  await search.submit('Apfel');
  assert.equal(latest().pending, false); assert.equal(latest().result.status, 'error');
  assert.equal(latest().result.message.includes('private'), false);
  await search.submit('Apfel'); await search.submit('Apfel');
  assert.equal(calls.length, 3); assert.equal(latest().result, success);
});

test('leaving the view cancels the timer and ignores pending responses without reusing its cache', async t => {
  const pending = deferred();
  const { search, calls, states } = setup(t, () => pending.promise);
  const work = search.submit('Birne'); await flush();
  search.change('Apfel');
  const count = states.length; search.dispose();
  t.mock.timers.tick(1000); pending.resolve(success); await work; await flush();
  assert.deepEqual(calls, ['Birne']); assert.equal(states.length, count);
  search.change('Mango'); await search.submit('Mango');
  assert.deepEqual(calls, ['Birne']);
});

test('IME text is not searched mid-composition; committed German letters are eligible', async t => {
  const { search, calls } = setup(t);
  search.change('Apfel'); t.mock.timers.tick(100);
  search.change('Käse', true); t.mock.timers.tick(1000); await flush();
  assert.deepEqual(calls, []);
  search.change('Käse'); t.mock.timers.tick(500); await flush();
  assert.deepEqual(calls, ['Käse']);
});

test('invalid explicit searches cancel the timer and show validation without a request', async t => {
  const { search, calls, latest } = setup(t);
  search.change('Apfel'); await search.submit('123');
  t.mock.timers.tick(1000); await flush();
  assert.deepEqual(calls, []); assert.equal(latest().result.status, 'error');
});
