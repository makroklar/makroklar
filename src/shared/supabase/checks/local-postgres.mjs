// Disposable SQL regression harness. Never loads .env or connects to Supabase.
// Expects the approved portable PostgreSQL instance at the fixed loopback endpoint.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const root = resolve('src/shared/supabase');
const runtime = resolve(root, '.temp/basis-pg-test');
const config = {
  host: '127.0.0.1', port: 55439, user: 'postgres',
  password: await readFile(resolve(runtime, 'password'), 'utf8'),
  connectionTimeoutMillis: 5000, statement_timeout: 60000,
};
const admin = new pg.Client({ ...config, database: 'postgres' });
const database = `basis_checks_${randomBytes(6).toString('hex')}`;
let client;
let current = 'local server verification';
const passed = [];
try {
  await admin.connect();
  const settings = (await admin.query('show data_directory')).rows[0].data_directory;
  assert.equal(resolve(settings).toLowerCase(), resolve(runtime, 'data').toLowerCase(), 'Unexpected PostgreSQL data directory');
  const version = Number((await admin.query('show server_version_num')).rows[0].server_version_num);
  assert.ok(version >= 170000 && version < 180000, 'PostgreSQL 17 required');
  // Database name is generated internally (letters, underscores and hex only).
  await admin.query(`create database "${database}"`);
  client = new pg.Client({ ...config, database });
  await client.connect();
  current = 'isolated Auth/role bootstrap';
  await client.query(`
    do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    end; $$;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, email_confirmed_at timestamptz,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
        nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
    $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
  `);
  for (const name of (await readdir(resolve(root, 'migrations'))).filter(name => name.endsWith('.sql')).sort()) {
    current = `migration ${name}`;
    await client.query(await readFile(resolve(root, 'migrations', name), 'utf8'));
    console.log(`PASS ${current}`);
  }
  for (const name of (await readdir(resolve(root, 'checks'))).filter(name => name.endsWith('.sql')).sort()) {
    current = `check ${name}`;
    // Existing checks all manage their transaction and finish with ROLLBACK.
    const sql = await readFile(resolve(root, 'checks', name), 'utf8');
    assert.match(sql.trim(), /rollback;$/i, 'Integration check must roll back fixtures');
    await client.query(sql);
    passed.push(name);
    console.log(`PASS ${current}`);
  }
  console.log(JSON.stringify({ status: 'passed', database, checks: passed.length, passed,
    environment: 'PostgreSQL 17 with minimal test Auth/roles; not the full Supabase stack' }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', database, step: current, code: error.code,
    message: error.message, position: error.position, where: error.where }));
  process.exitCode = 1;
} finally {
  if (client) { await client.query('rollback').catch(() => {}); await client.end(); }
  // Retain the isolated database for diagnosis. It has synthetic fixtures only;
  // failed check transactions were rolled back. Never DROP user databases here.
  await admin.end();
}
