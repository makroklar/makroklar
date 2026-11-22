import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import test from 'node:test';
import { registrationCallbackUrl } from './registrationRedirect.ts';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const serverMock = 'data:text/javascript,' + encodeURIComponent(
  'export const createClient = headers => globalThis.__registrationTestClient(headers);',
);
const headersMock = 'data:text/javascript,' + encodeURIComponent(
  'export async function headers() { return new Headers(globalThis.__registrationTestOrigin ? { origin: globalThis.__registrationTestOrigin } : {}); }',
);
const navigationMock = 'data:text/javascript,' + encodeURIComponent(
  'export function redirect(destination) { const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error; }',
);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/shared/supabase/server') return { url: serverMock, shortCircuit: true };
    if (specifier === 'next/server') return next('next/server.js', context);
    if (specifier === 'next/headers') return { url: headersMock, shortCircuit: true };
    if (specifier === 'next/navigation') return { url: navigationMock, shortCircuit: true };
    if (specifier.startsWith('./') && context.parentURL?.includes('/src/areas/business/auth/')
        && !/\.(?:ts|js|mjs)$/.test(specifier)) return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});
const { handleRegistrationCallback } = await import('./registrationCallback.ts');
const { registerAccount } = await import('./registrationAction.ts');
const { initialRegistrationState } = await import('./registration.ts');

function mockClient({ exchangeError = null, userError = null, confirmed = true, rpcError = null, throws = false, signUpSession = null } = {}) {
  const calls = [];
  globalThis.__registrationTestClient = async headers => {
    if (throws) throw new Error('private provider detail');
    return {
      auth: {
        async signUp(credentials) {
          calls.push(['signUp', credentials]);
          return { data: { session: signUpSession }, error: null };
        },
        async exchangeCodeForSession(...args) {
          calls.push(['exchange', ...args]);
          // Stand in for the server helper's cookie-store writes and SDK headers.
          headers.append('Set-Cookie', 'synthetic-session=token; Path=/; HttpOnly; SameSite=Lax');
          headers.set('Cache-Control', 'private, no-store, max-age=0');
          return { error: exchangeError };
        },
        async getUser() {
          calls.push(['getUser']);
          return { data: { user: confirmed ? { id: 'synthetic-user', email_confirmed_at: '2026-11-10' } : null }, error: userError };
        },
      },
      async rpc(...args) {
        calls.push(['rpc', ...args]);
        return { data: rpcError ? null : 'synthetic-restaurant', error: rpcError };
      },
    };
  };
  return calls;
}

function request(query = '') { return new NextRequest('http://localhost:3000/business/auth/callback' + query); }
function location(response) { return new URL(response.headers.get('Location')); }

test('callback URL is fixed to the validated request origin', () => {
  assert.equal(registrationCallbackUrl('http://localhost:3000'), 'http://localhost:3000/business/auth/callback');
  assert.equal(registrationCallbackUrl('https://example.com'), 'https://example.com/business/auth/callback');
  for (const origin of [null, 'null', 'javascript:alert(1)', 'https://name:password@example.com', 'https://example.com/other', 'https://example.com?next=foreign']) {
    assert.throws(() => registrationCallbackUrl(origin));
  }
});

test('a code is exchanged, identity verified, and completion called before a fixed welcome redirect', async () => {
  const calls = mockClient();
  const response = await handleRegistrationCallback(request('?code=synthetic-code&sb_flow_id=synthetic-flow&next=https://foreign.invalid'));
  assert.equal(response.status, 303);
  assert.deepEqual(calls, [['exchange', 'synthetic-code', { flowId: 'synthetic-flow' }], ['getUser'], ['rpc', 'complete_restaurant_registration']]);
  assert.equal(location(response).href, 'http://localhost:3000/business/welcome');
  assert.match(response.headers.get('Set-Cookie'), /synthetic-session/);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
});

test('provider-declared failures are sanitized without calling Auth or reflecting the query', async () => {
  const calls = mockClient();
  const response = await handleRegistrationCallback(request('?error=access_denied&error_description=private-detail&next=//foreign.invalid'));
  assert.deepEqual(calls, []);
  assert.equal(location(response).search, '?registration=confirmation-error');
  assert.ok(!response.headers.get('Location').includes('private-detail'));
});

test('expired or already-used codes never create restaurants', async () => {
  const calls = mockClient({ exchangeError: { code: 'flow_state_expired' } });
  const response = await handleRegistrationCallback(request('?code=used-code'));
  assert.equal(calls.length, 1);
  assert.equal(location(response).search, '?registration=confirmation-error');
});

test('missing or rejected identities never invoke the completion RPC', async () => {
  for (const options of [{ confirmed: false }, { userError: { message: 'private detail' } }]) {
    const calls = mockClient(options);
    const response = await handleRegistrationCallback(request());
    assert.deepEqual(calls, [['getUser']]);
    assert.equal(location(response).search, '?registration=confirmation-error');
  }
});

test('failed completion preserves the session and offers a retry without reusing the code', async () => {
  mockClient({ rpcError: { message: 'private detail' } });
  const response = await handleRegistrationCallback(request('?code=synthetic-code'));
  assert.equal(location(response).search, '?registration=setup-error');
  assert.match(response.headers.get('Set-Cookie'), /synthetic-session/);
  const calls = mockClient();
  const retry = await handleRegistrationCallback(request());
  assert.deepEqual(calls, [['getUser'], ['rpc', 'complete_restaurant_registration']]);
  assert.equal(location(retry).pathname, '/business/welcome');
});

test('unexpected failures return a local uncached error redirect without provider details', async () => {
  mockClient({ throws: true });
  const response = await handleRegistrationCallback(request('?code=synthetic-code'));
  assert.equal(location(response).search, '?registration=confirmation-error');
  assert.match(response.headers.get('Cache-Control'), /no-store/);
});

function signupForm() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ restaurantName: 'Restaurant am Markt', email: 'synthetic@example.invalid', password: 'synthetic-password', termsAccepted: 'on' })) data.set(key, value);
  return data;
}

test('the real Server Action includes the callback URL while retaining restaurant metadata', async () => {
  globalThis.__registrationTestOrigin = 'https://example.com';
  const calls = mockClient();
  const state = await registerAccount(initialRegistrationState, signupForm());
  assert.equal(state.status, 'confirmation');
  assert.deepEqual(calls, [['signUp', {
    email: 'synthetic@example.invalid', password: 'synthetic-password',
    options: { data: { restaurant_name: 'Restaurant am Markt' }, emailRedirectTo: 'https://example.com/business/auth/callback' },
  }]]);
});

test('an immediate Auth session uses the same completion callback without swallowing the Next redirect', async () => {
  globalThis.__registrationTestOrigin = 'https://example.com';
  mockClient({ signUpSession: { access_token: 'synthetic-token' } });
  await assert.rejects(registerAccount(initialRegistrationState, signupForm()), error => error.destination === '/business/auth/callback');
});

test('a missing request origin prevents signup instead of guessing an email redirect', async () => {
  globalThis.__registrationTestOrigin = null;
  const calls = mockClient();
  const state = await registerAccount(initialRegistrationState, signupForm());
  assert.equal(state.status, 'error');
  assert.deepEqual(calls, []);
});
