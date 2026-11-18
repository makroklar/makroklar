import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { completeLocalLogout, logoutFailureMessage } from './logout.ts';

const serverMock = 'data:text/javascript,' + encodeURIComponent(
  'export const createClient = () => globalThis.__accountAccessClient();',
);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/shared/supabase/server') return { url: serverMock, shortCircuit: true };
    if (specifier === './logout' && context.parentURL?.endsWith('/auth/logoutAction.ts')) return next('./logout.ts', context);
    return next(specifier, context);
  },
});
const { getAuthPageAccount } = await import('./authPageAccount.ts');
const { logout } = await import('./logoutAction.ts');

test('account pages expose only the email returned by verified getUser', async () => {
  let called = false;
  globalThis.__accountAccessClient = () => ({ auth: { getUser: async () => {
    called = true;
    return { data: { user: { id: 'synthetic-user', email: 'synthetic@example.invalid', user_metadata: { token: 'synthetic-private-value' } } }, error: null };
  } } });
  assert.deepEqual(await getAuthPageAccount(), { status: 'signed-in', email: 'synthetic@example.invalid' });
  assert.equal(called, true);
});

test('missing, expired and invalid sessions allow the anonymous forms', async () => {
  for (const error of [null, { name: 'AuthSessionMissingError' }, { status: 401 }, { status: 403 }, { code: 'bad_jwt' }]) {
    globalThis.__accountAccessClient = () => ({ auth: { getUser: async () => ({ data: { user: null }, error }) } });
    assert.deepEqual(await getAuthPageAccount(), { status: 'anonymous' });
  }
});

test('an unavailable Auth service does not masquerade as a logged-out account', async () => {
  globalThis.__accountAccessClient = () => ({ auth: { getUser: async () => ({ data: { user: null }, error: { status: 503, message: 'private provider detail' } }) } });
  assert.deepEqual(await getAuthPageAccount(), { status: 'unavailable' });
  globalThis.__accountAccessClient = () => { throw new Error('private configuration detail'); };
  assert.deepEqual(await getAuthPageAccount(), { status: 'unavailable' });
});

test('an unexpected account without an email does not expose an incomplete identity', async () => {
  globalThis.__accountAccessClient = () => ({ auth: { getUser: async () => ({ data: { user: { id: 'synthetic-user' } }, error: null }) } });
  assert.deepEqual(await getAuthPageAccount(), { status: 'unavailable' });
});

test('logout requests only the current session and returns no credentials', async () => {
  const calls = [];
  globalThis.__accountAccessClient = () => ({ auth: {
    signOut: async options => { calls.push(options); return { error: null }; },
    getSession: async () => assert.fail('Unexpected storage check'),
  } });
  assert.deepEqual(await logout(), { status: 'signed-out', message: '' });
  assert.deepEqual(calls, [{ scope: 'local' }]);
});

test('failed remote revocation still completes cleanup when the local session is already gone', async () => {
  globalThis.__accountAccessClient = () => ({ auth: {
    signOut: async () => ({ error: { status: 503, message: 'private provider detail' } }),
    getSession: async () => ({ data: { session: null }, error: null }),
  } });
  assert.deepEqual(await logout(), { status: 'signed-out', message: '' });
});

test('a remaining or unreadable local session produces safe retry feedback', async () => {
  for (const local of [{ data: { session: { access_token: 'synthetic-token' } }, error: null }, { data: { session: null }, error: { message: 'private detail' } }]) {
    globalThis.__accountAccessClient = () => ({ auth: {
      signOut: async () => ({ error: { message: 'private detail' } }),
      getSession: async () => local,
    } });
    assert.deepEqual(await logout(), { status: 'error', message: logoutFailureMessage });
  }
});

test('unexpected logout failures are sanitized', async () => {
  globalThis.__accountAccessClient = () => { throw new Error('private configuration detail'); };
  assert.deepEqual(await logout(), { status: 'error', message: logoutFailureMessage });
});

test('draft clearing and hard navigation occur only after the server confirms local sign-out', async () => {
  const events = [];
  let complete;
  const serverResponse = new Promise(resolve => { complete = resolve; });
  const work = completeLocalLogout(() => serverResponse, () => events.push('resetDraft'), url => events.push(url));
  assert.deepEqual(events, []);
  complete({ status: 'signed-out', message: '' });
  await work;
  assert.deepEqual(events, ['resetDraft', '/business/login']);
});

test('failed logout does not discard the draft or navigate', async () => {
  const state = await completeLocalLogout(
    async () => ({ status: 'error', message: logoutFailureMessage }),
    () => assert.fail('Draft was discarded'),
    () => assert.fail('Unexpected navigation'),
  );
  assert.equal(state.status, 'error');
});

test('a rejected Server Action preserves the draft and returns safe retry feedback', async () => {
  const state = await completeLocalLogout(
    async () => { throw new Error('private transport detail'); },
    () => assert.fail('Draft was discarded'),
    () => assert.fail('Unexpected navigation'),
  );
  assert.deepEqual(state, { status: 'error', message: logoutFailureMessage });
});
