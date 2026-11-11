import assert from 'node:assert/strict';
import test from 'node:test';
import { registerRestaurantAccount } from './registration.ts';

function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    restaurantName: '  Restaurant am Markt  ',
    email: '  test@example.com  ',
    password: ' synthetic-password ',
    termsAccepted: 'on',
    ...overrides,
  })) data.set(key, value);
  return data;
}

const successfulResponse = { data: { session: null, user: { id: 'synthetic-user' } }, error: null };

test('invalid fields and missing consent prevent any signup request', async () => {
  let called = false;
  const state = await registerRestaurantAccount(form({
    restaurantName: ' ', email: 'invalid', password: '', termsAccepted: '',
  }), async () => { called = true; return successfulResponse; });
  assert.equal(called, false);
  assert.equal(state.status, 'error');
  assert.deepEqual(Object.keys(state.fieldErrors).sort(), ['email', 'password', 'restaurantName', 'termsAccepted']);
});

test('non-text form values cannot bypass server validation', async () => {
  const data = form();
  data.set('restaurantName', new Blob(['not a name']), 'name.txt');
  const state = await registerRestaurantAccount(data, async () => assert.fail('unexpected signup'));
  assert.ok(state.fieldErrors.restaurantName);
});

test('signup sends trimmed names and email, preserves the password, and only uses documented metadata', async () => {
  let credentials;
  const state = await registerRestaurantAccount(form(), async input => {
    credentials = input;
    return successfulResponse;
  });
  assert.deepEqual(credentials, {
    email: 'test@example.com',
    password: ' synthetic-password ',
    options: { data: { restaurant_name: 'Restaurant am Markt' } },
  });
  assert.equal(state.status, 'confirmation');
  assert.deepEqual(state.values, { email: 'test@example.com', restaurantName: 'Restaurant am Markt' });
  assert.ok(!JSON.stringify(state).includes('synthetic-password'));
  assert.ok(!JSON.stringify(state).includes('synthetic-user'));
});

test('existing accounts receive the same neutral confirmation as new requests', async () => {
  const success = await registerRestaurantAccount(form(), async () => successfulResponse);
  for (const code of ['user_already_exists', 'email_exists']) {
    const existing = await registerRestaurantAccount(form(), async () => ({ data: { session: null }, error: { code } }));
    assert.deepEqual(existing, success);
  }
});

test('weak passwords and malformed email get relevant field feedback without SDK internals', async () => {
  for (const [code, field] of [['weak_password', 'password'], ['email_address_invalid', 'email']]) {
    const state = await registerRestaurantAccount(form(), async () => ({
      data: { session: null }, error: { code, message: 'private provider detail' },
    }));
    assert.equal(state.status, 'error');
    assert.ok(state.fieldErrors[field]);
    assert.ok(!JSON.stringify(state).includes('private provider detail'));
  }
});

test('rate limits are retryable and other provider errors stay generic', async () => {
  for (const code of ['over_email_send_rate_limit', 'over_request_rate_limit', 'email_address_not_authorized', 'unexpected_failure']) {
    const state = await registerRestaurantAccount(form(), async () => ({
      data: { session: null }, error: { code, message: 'private provider detail' },
    }));
    assert.equal(state.status, 'error');
    assert.ok(!JSON.stringify(state).includes('private provider detail'));
    if (code.startsWith('over_')) assert.match(state.message, /warte/);
  }
});

test('transport or client-configuration failures return safe retryable feedback', async () => {
  const state = await registerRestaurantAccount(form(), async () => { throw new Error('private connection detail'); });
  assert.equal(state.status, 'error');
  assert.ok(!JSON.stringify(state).includes('private connection detail'));
});

test('an immediate session is acknowledged without leaking tokens or provisioning restaurants', async () => {
  const state = await registerRestaurantAccount(form(), async () => ({
    data: { session: { access_token: 'synthetic-secret-token' } }, error: null,
  }));
  assert.equal(state.status, 'registered');
  assert.ok(!JSON.stringify(state).includes('synthetic-secret-token'));
});
