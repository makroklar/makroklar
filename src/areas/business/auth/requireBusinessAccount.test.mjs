import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const accountMock = 'data:text/javascript,' + encodeURIComponent(
  'export const getAuthPageAccount = () => globalThis.__businessGuardAccount();',
);
const navigationMock = 'data:text/javascript,' + encodeURIComponent(
  'export function redirect(destination) { const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error; }',
);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './authPageAccount' && context.parentURL?.endsWith('/auth/requireBusinessAccount.ts')) return { url: accountMock, shortCircuit: true };
    if (specifier === 'next/navigation') return { url: navigationMock, shortCircuit: true };
    return next(specifier, context);
  },
});
const { requireBusinessAccount } = await import('./requireBusinessAccount.ts');

test('verified signed-in accounts can continue rendering', async () => {
  globalThis.__businessGuardAccount = async () => ({ status: 'signed-in', email: 'synthetic@example.invalid' });
  assert.deepEqual(await requireBusinessAccount(), { status: 'signed-in', email: 'synthetic@example.invalid' });
});

test('an anonymous request redirects to the fixed Login route before protected work', async () => {
  globalThis.__businessGuardAccount = async () => ({ status: 'anonymous' });
  let protectedWorkRan = false;
  await assert.rejects(async () => {
    await requireBusinessAccount();
    protectedWorkRan = true;
  }, error => error.destination === '/business/login');
  assert.equal(protectedWorkRan, false);
});

test('an unavailable Auth service cannot grant access to protected content', async () => {
  globalThis.__businessGuardAccount = async () => ({ status: 'unavailable' });
  await assert.rejects(requireBusinessAccount(), error => error.destination === '/business/login');
});

test('a later anonymous check is denied after a signed-in check outside a render pass', async () => {
  globalThis.__businessGuardAccount = async () => ({ status: 'signed-in', email: 'synthetic@example.invalid' });
  await requireBusinessAccount();
  globalThis.__businessGuardAccount = async () => ({ status: 'anonymous' });
  await assert.rejects(requireBusinessAccount(), error => error.destination === '/business/login');
});
