import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { beforeEach, after } from 'node:test';

const moduleFor = code => ({ url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return moduleFor('');
  if (specifier === '@supabase/supabase-js') return moduleFor('export const createClient = (...args) => globalThis.__cacheClient(...args);');
  if (specifier === '@/shared/supabase/config') return moduleFor('export const getSupabasePublicConfig = () => ({url:"https://example.invalid",publishableKey:"sb_publishable_test"});');
  if (['./onboardingModel','./foodSearchModel','./recipeDraft'].includes(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { publishOffCache } = await import('./offCache.ts');
const original = process.env.SUPABASE_SECRET_KEY;
after(() => { if (original === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = original; });
let clients, calls, failure;
beforeEach(() => {
  delete process.env.SUPABASE_SECRET_KEY; clients = []; calls = []; failure = null;
  globalThis.__cacheClient = (...args) => { clients.push(args); return { rpc: async (...call) => { calls.push(call); return { error: failure }; } }; };
});
const food = () => ({ id: 'off:3017620422003', name: 'Test', detail: '', basis: '100g', preparation: 'as_sold',
  energyKcal: 0, proteinG: null, fatG: 0, carbohydrateG: 0,
  source: { kind: 'off', barcode: '3017620422003', fetchedAt: '2026-11-17T10:00:00Z', modifiedAt: null } });

test('missing key or empty products needs no administrative client', async () => {
  await publishOffCache('restaurant', 'request', [food()]);
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  await publishOffCache('restaurant', 'request', []);
  assert.equal(clients.length, 0);
});
test('server client has no session persistence; RPC receives only allowed provider fields', async () => {
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  await publishOffCache('restaurant', 'request', [{ ...food(), privateNote: 'never publish', restaurantId: 'private' }]);
  assert.deepEqual(clients[0][2].auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  assert.equal(clients[0][1], 'sb_secret_test');
  assert.deepEqual(calls, [['publish_confirmed_off_products', { target_restaurant_id: 'restaurant', saved_request_id: 'request', products: [food()] }]]);
});
test('bad key/provider data is rejected and database failures do not expose secrets', async () => {
  process.env.SUPABASE_SECRET_KEY = 'sb_publishable_wrong';
  await assert.rejects(publishOffCache('r','q',[food()]), /configuration/);
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  await assert.rejects(publishOffCache('r','q',[{ ...food(), source: { kind: 'manual' } }]));
  assert.equal(clients.length, 0);
  failure = { message: 'sensitive server details' };
  await assert.rejects(publishOffCache('r','q',[food()]), /^Error: Shared product cache is unavailable\.$/);
});
