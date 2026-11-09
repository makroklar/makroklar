import assert from 'node:assert/strict';
import test from 'node:test';
import { mapFoodHeaders, parseNutrientValue } from './bls-reader.mjs';
import { connectionConfig, importBls } from './import-bls.mjs';

test('zero is numeric; missing values, traces and detection limits remain distinct', () => {
  assert.deepEqual(parseNutrientValue(0), { value: '0', raw_value: '0', value_kind: 'numeric' });
  assert.equal(parseNutrientValue(12.375).value, '12.375');
  const cases = [
    [null, 'missing'], [undefined, 'missing'], ['-', 'missing'], ['TR', 'trace'],
    ['<LOD', 'below_lod'], ['<LOQ', 'below_loq'], ['<LOD or <LOQ', 'below_lod_or_loq'],
  ];
  for (const [raw, kind] of cases) {
    assert.deepEqual(parseNutrientValue(raw), { value: null, raw_value: raw ?? null, value_kind: kind });
  }
  for (const invalid of [-1, NaN, Infinity, '', '1.25', 'unknown', { formula: '1+1', result: 2 }]) {
    assert.throws(() => parseNutrientValue(invalid), /refusing to guess/);
  }
});

test('column mapping checks nutrient codes, per-100g units and provenance columns', () => {
  const definitions = [{ code: 'PROT', unit: 'g' }, { code: 'F4:0', unit: 'mg' }];
  const headers = ['BLS Code', 'Lebensmittelbezeichnung', 'Food name',
    'PROT Protein [g/100g]', 'PROT Datenherkunft', 'PROT Referenz',
    'F4:0 Buttersaeure [mg/100g]', 'F4:0 Datenherkunft', 'F4:0 Referenz', 'Hinweis'];
  assert.deepEqual(mapFoodHeaders(headers, definitions), [
    { code: 'PROT', column: 3 }, { code: 'F4:0', column: 6 },
  ]);
  for (const [index, replacement] of [[0, 'Code'], [3, 'PROT Protein [g/portion]'],
    [4, 'PROT Referenz'], [6, 'PROT Protein [g/100g]'], [9, 'Other']]) {
    const changed = [...headers]; changed[index] = replacement;
    assert.throws(() => mapFoodHeaders(changed, definitions));
  }
  assert.throws(() => mapFoodHeaders(headers.slice(0, -1), definitions));
});

const projectRef = 'osdbsbbcnftussvgumjh';

test('database target is pinned to the project and TLS verification stays enabled', async () => {
  const direct = await connectionConfig(`postgresql://postgres:fake%40password@db.${projectRef}.supabase.co/postgres?sslmode=require`, projectRef);
  assert.equal(direct.password, 'fake@password');
  assert.equal(direct.ssl.rejectUnauthorized, true);
  assert.equal(direct.host, `db.${projectRef}.supabase.co`);
  assert.equal(direct.connectionString, undefined);
  const pooler = await connectionConfig(`postgres://postgres.${projectRef}:fake@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`, projectRef);
  assert.equal(pooler.user, `postgres.${projectRef}`);
  assert.equal(pooler.ssl.rejectUnauthorized, true);
  for (const url of [
    'postgres://postgres:fake@db.aaaaaaaaaaaaaaaaaaaa.supabase.co/postgres',
    'postgres://postgres.wrong:fake@aws-0-eu-central-1.pooler.supabase.com/postgres',
    `postgres://postgres:fake@db.${projectRef}.supabase.co/postgres?sslmode=disable`,
    `postgres://postgres:fake@db.${projectRef}.supabase.co/postgres?host=other.example`,
  ]) await assert.rejects(connectionConfig(url, projectRef));
  await assert.rejects(connectionConfig(null, projectRef), /BLS_DATABASE_URL/);
  await assert.rejects(connectionConfig('postgres://fake', ''), /project-ref/);
});

function fixture() {
  let verifications = 0;
  return {
    manifest: { source: 'bls', version: 'test', releaseYear: 2025, files: [], sourceUrl: 'https://blsdb.de' },
    contentHash: 'a'.repeat(64), definitions: [{ code: 'PROT' }],
    summary: { foods: 2, nutrients: 1, values: 2 },
    async verifyFiles() { verifications++; },
    get verifications() { return verifications; },
    async *foods() {
      for (const code of ['TEST001', 'TEST002']) yield {
        bls_code: code, name_de: "Test 'mit Apostroph'", name_en: 'Test', source_row: 2,
        notes: null, nutrients: [{ nutrient_code: 'PROT', ...parseNutrientValue(0) }],
      };
    },
  };
}

function database({ existing = false, counts = { foods: '2', nutrients: '1', values: '2' }, failOn } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, parameters) {
      const statement = sql.trim().replace(/\s+/g, ' ');
      calls.push({ statement, parameters });
      if (failOn && statement.includes(failOn)) throw new Error('Simulated database failure');
      if (statement.startsWith('select id from')) return { rows: existing ? [{ id: 'dataset' }] : [] };
      if (statement.startsWith('insert into public.nutrition_datasets')) return { rows: [{ id: 'dataset' }] };
      if (statement.startsWith('select (select count')) return { rows: [counts] };
      return { rows: [] };
    },
  };
}

test('import batches preserve original codes and commit only after complete verification', async () => {
  const source = fixture();
  const client = database();
  const result = await importBls(client, source, 1);
  assert.equal(result.status, 'imported');
  assert.equal(source.verifications, 2);
  assert.equal(client.calls[0].statement, 'begin');
  assert.equal(client.calls.at(-1).statement, 'commit');
  const foods = client.calls.filter(({ statement }) => statement.startsWith('insert into public.bls_foods'));
  const values = client.calls.filter(({ statement }) => statement.startsWith('insert into public.bls_food_nutrients'));
  assert.equal(foods.length, 2);
  assert.equal(values.length, 2);
  assert.equal(JSON.parse(foods[0].parameters[1])[0].bls_code, 'TEST001');
  assert.equal(JSON.parse(foods[0].parameters[1])[0].name_de, "Test 'mit Apostroph'");
  assert.equal(JSON.parse(values[0].parameters[1])[0].value, '0');
  assert.ok(client.calls.indexOf(foods[0]) < client.calls.indexOf(values[0]));
  assert.ok(client.calls.findIndex(({ statement }) => statement.startsWith('select (select count'))
    < client.calls.findIndex(({ statement }) => statement.startsWith('update public.nutrition_datasets')));
});

test('repeating an existing verified dataset does not insert or reactivate anything', async () => {
  const client = database({ existing: true });
  assert.equal((await importBls(client, fixture())).status, 'already_imported');
  assert.equal(client.calls.at(-1).statement, 'rollback');
  assert.ok(client.calls.every(({ statement }) => !/^(insert|update|delete|commit)/.test(statement)));
});

test('write failure, incomplete database counts or changed source all roll back', async () => {
  for (const settings of [
    { failOn: 'insert into public.bls_food_nutrients' },
    { counts: { foods: 1, nutrients: 1, values: 1 } },
    { existing: true, counts: { foods: 2, nutrients: 1, values: 0 } },
  ]) {
    const client = database(settings);
    await assert.rejects(importBls(client, fixture()));
    assert.equal(client.calls.at(-1).statement, 'rollback');
    assert.ok(client.calls.every(({ statement }) => statement !== 'commit'));
  }
  const source = fixture();
  let verified = false;
  source.verifyFiles = async () => {
    if (verified) throw new Error('Changed file checksum');
    verified = true;
  };
  const client = database();
  await assert.rejects(importBls(client, source), /checksum/);
  assert.equal(client.calls.at(-1).statement, 'rollback');
  assert.ok(client.calls.every(({ statement }) => !statement.startsWith('update public.nutrition_datasets')));
});
