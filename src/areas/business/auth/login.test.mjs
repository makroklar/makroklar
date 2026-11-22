import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { initialLoginState, loginWithPassword } from './login.ts';

const serverMock = 'data:text/javascript,' + encodeURIComponent(
  'export const createClient = () => globalThis.__loginTestClient();',
);
const navigationMock = 'data:text/javascript,' + encodeURIComponent(
  'export function redirect(destination) { const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error; }',
);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/shared/supabase/server') return { url: serverMock, shortCircuit: true };
    if (specifier === 'next/navigation') return { url: navigationMock, shortCircuit: true };
    if (specifier === './login' && context.parentURL?.endsWith('/auth/loginAction.ts')) return next('./login.ts', context);
    return next(specifier, context);
  },
});
const { login } = await import('./loginAction.ts');

function form(overrides = {}) {
  const data = new FormData();
  for (const [name, value] of Object.entries({ email: '  synthetic@example.invalid  ', password: ' synthetic-password ', ...overrides })) data.set(name, value);
  return data;
}
const success = { data: { session: { access_token: 'synthetic-token' }, user: { id: 'synthetic-user' } }, error: null };

test('invalid email and missing password are rejected before any Auth request', async () => {
  const state = await loginWithPassword(form({ email: 'invalid', password: '' }), async () => assert.fail('Unexpected Auth request'));
  assert.equal(state.status, 'error');
  assert.deepEqual(Object.keys(state.fieldErrors).sort(), ['email', 'password']);
});

test('non-text form fields cannot bypass validation', async () => {
  const data = form();
  data.set('email', new Blob(['synthetic@example.invalid']), 'email.txt');
  data.set('password', new Blob(['synthetic-password']), 'password.txt');
  const state = await loginWithPassword(data, async () => assert.fail('Unexpected Auth request'));
  assert.ok(state.fieldErrors.email);
  assert.ok(state.fieldErrors.password);
});

test('email is trimmed, password whitespace is preserved, and secrets are absent from returned state', async () => {
  let credentials;
  const state = await loginWithPassword(form(), async input => { credentials = input; return success; });
  assert.deepEqual(credentials, { email: 'synthetic@example.invalid', password: ' synthetic-password ' });
  assert.deepEqual(state, { status: 'authenticated', message: '', fieldErrors: {}, email: 'synthetic@example.invalid' });
  for (const value of ['synthetic-password', 'synthetic-token', 'synthetic-user']) assert.ok(!JSON.stringify(state).includes(value));
});

test('the same credentials error covers unknown accounts and wrong passwords', async () => {
  const states = [];
  for (const message of ['User does not exist', 'Incorrect secret password']) {
    states.push(await loginWithPassword(form(), async () => ({ data: { session: null }, error: { code: 'invalid_credentials', message } })));
  }
  assert.deepEqual(states[0], states[1]);
  assert.equal(states[0].message, 'E-Mail-Adresse oder Passwort ist nicht korrekt.');
});

test('unconfirmed email and rate limits provide actionable feedback without provider details', async () => {
  for (const [code, expected] of [['email_not_confirmed', /bestätige/], ['over_request_rate_limit', /warte/]]) {
    const state = await loginWithPassword(form(), async () => ({ data: { session: null }, error: { code, message: 'private provider detail' } }));
    assert.equal(state.status, 'error');
    assert.match(state.message, expected);
    assert.ok(!JSON.stringify(state).includes('private provider detail'));
  }
});

test('unknown provider and connection errors stay generic and retryable', async () => {
  const returned = await loginWithPassword(form(), async () => ({ data: { session: null }, error: { code: 'unexpected_failure', message: 'private connection detail' } }));
  const thrown = await loginWithPassword(form(), async () => { throw new Error('private connection detail'); });
  assert.deepEqual(returned, thrown);
  assert.equal(returned.status, 'error');
  assert.ok(!JSON.stringify(returned).includes('private connection detail'));
});

test('an empty session is not considered a successful login', async () => {
  const state = await loginWithPassword(form(), async () => ({ data: { session: null }, error: null }));
  assert.equal(state.status, 'error');
});

test('the real Server Action never creates a client for invalid input', async () => {
  globalThis.__loginTestClient = () => assert.fail('Unexpected client creation');
  const state = await login(initialLoginState, form({ password: '' }));
  assert.equal(state.status, 'error');
});

test('the real Server Action forwards credentials and redirects only to the completion callback', async () => {
  const calls = [];
  globalThis.__loginTestClient = () => ({ auth: { signInWithPassword: async credentials => { calls.push(credentials); return success; } } });
  const data = form({ next: 'https://foreign.invalid', restaurant_id: 'foreign-restaurant' });
  await assert.rejects(login(initialLoginState, data), error => error.destination === '/business/auth/callback');
  assert.deepEqual(calls, [{ email: 'synthetic@example.invalid', password: ' synthetic-password ' }]);
});

test('the real Server Action returns failed credentials without redirecting', async () => {
  globalThis.__loginTestClient = () => ({ auth: { signInWithPassword: async () => ({ data: { session: null }, error: { code: 'invalid_credentials' } }) } });
  const state = await login(initialLoginState, form());
  assert.equal(state.status, 'error');
});
