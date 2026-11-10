import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { after, test } from 'node:test';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
// This is the matcher testing API exposed by the installed Next.js 16.4.3.
const { unstable_doesMiddlewareMatch } = require('next/experimental/testing/server');
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

// Exercise the real Next request/response classes with controlled SDK refresh events.
const sdkMock = 'data:text/javascript,' + encodeURIComponent(
  'export function createServerClient(...args) { return globalThis.__makroklarProxySdkFactory(...args); }',
);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@supabase/ssr' && context.parentURL?.endsWith('/supabase/proxy.ts')) {
      return { url: sdkMock, shortCircuit: true };
    }
    if (specifier === 'next/server') return next('next/server.js', context);
    if (specifier === '@/shared/supabase/proxy') {
      return { url: new URL('./proxy.ts', import.meta.url).href, shortCircuit: true };
    }
    if (specifier.startsWith('./') && context.parentURL?.includes('/src/shared/supabase/')
        && !/\.(?:ts|js|mjs)$/.test(specifier)) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  },
});
const { proxy, config } = await import('../../proxy.ts');

function mockClaims(callback) {
  globalThis.__makroklarProxySdkFactory = (_url, _key, options) => ({
    auth: { getClaims: () => callback(options.cookies) },
  });
}

after(() => {
  delete globalThis.__makroklarProxySdkFactory;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
});

test('matcher covers business routes and excludes landing, guest, assets and similar prefixes', () => {
  for (const path of ['/business', '/business/', '/business/register',
    '/business/onboarding/menu/pos', '/business/onboarding/purchases?test=1']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url: `http://localhost${path}` }), true, path);
  }
  for (const path of ['/', '/contact', '/guest', '/guest/dish', '/business-other',
    '/_next/static/chunk.js', '/api/items']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url: `http://localhost${path}` }), false, path);
  }
});

test('anonymous request passes without redirect or session-cookie writes', async () => {
  let calls = 0;
  mockClaims(async (cookies) => {
    calls++;
    assert.deepEqual(cookies.getAll(), []);
    return { data: null, error: null };
  });
  const response = await proxy(new NextRequest('http://localhost/business/register'));
  assert.equal(calls, 1);
  assert.equal(response.headers.get('x-middleware-next'), '1');
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('cache-control'), null);
  assert.deepEqual(response.cookies.getAll(), []);
});

test('multiple refresh batches reach the browser and downstream request with cache headers intact', async () => {
  const options = { path: '/', secure: true, httpOnly: true, sameSite: 'lax', maxAge: 3600 };
  mockClaims(async (cookies) => {
    assert.equal(cookies.getAll().find((cookie) => cookie.name === 'keep')?.value, 'original');
    cookies.setAll([
      { name: 'session.0', value: 'first', options },
      { name: 'expired', value: '', options: { path: '/', maxAge: 0 } },
    ], {
      'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
      Expires: '0', Pragma: 'no-cache',
    });
    cookies.setAll([
      { name: 'session.1', value: 'second', options },
      { name: 'session.0', value: 'replacement', options },
    ], {});
    return { data: { claims: { sub: 'synthetic-user' } }, error: null };
  });
  const request = new NextRequest('https://example.test/business', { headers: { cookie: 'keep=original' } });
  const response = await proxy(request);
  assert.equal(response.cookies.get('session.0')?.value, 'replacement');
  assert.equal(response.cookies.get('session.1')?.value, 'second');
  assert.equal(response.cookies.get('session.0')?.httpOnly, true);
  assert.equal(response.cookies.get('session.0')?.secure, true);
  assert.equal(response.cookies.get('session.0')?.sameSite, 'lax');
  assert.equal(response.cookies.get('expired')?.maxAge, 0);
  assert.equal(response.headers.get('cache-control'), 'private, no-cache, no-store, must-revalidate, max-age=0');
  assert.equal(response.headers.get('expires'), '0');
  assert.equal(response.headers.get('pragma'), 'no-cache');
  const downstream = new NextRequest('https://example.test/business', {
    headers: { cookie: response.headers.get('x-middleware-request-cookie') ?? '' },
  });
  assert.equal(downstream.cookies.get('session.0')?.value, 'replacement');
  assert.equal(downstream.cookies.get('session.1')?.value, 'second');
  assert.equal(downstream.cookies.get('keep')?.value, 'original');
});

test('unexpected SDK failures propagate instead of returning a successful refresh response', async () => {
  mockClaims(async () => { throw new Error('Synthetic SDK failure'); });
  await assert.rejects(proxy(new NextRequest('http://localhost/business')), /Synthetic SDK failure/);
});
