import { loadEnvFile } from 'node:process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { openBlsSource } from './bls-reader.mjs';

const manifestPath = fileURLToPath(new URL('./bls-4.0-2025.manifest.json', import.meta.url));

async function checkCounts(client, datasetId, expected) {
  const result = await client.query(`
    select (select count(*) from public.bls_foods where dataset_id = $1) as foods,
      (select count(*) from public.nutrients where dataset_id = $1) as nutrients,
      (select count(*) from public.bls_food_nutrients where dataset_id = $1) as values`, [datasetId]);
  const actual = result.rows[0];
  if (Number(actual.foods) !== expected.foods || Number(actual.nutrients) !== expected.nutrients
      || Number(actual.values) !== expected.values) throw new Error('Database counts do not match the validated source.');
}

async function insertFoodBatch(client, datasetId, foods) {
  const metadata = foods.map(({ nutrients, ...food }) => food);
  const values = foods.flatMap((food) => food.nutrients.map((nutrient) => ({
    bls_code: food.bls_code, ...nutrient,
  })));
  await client.query(`
    insert into public.bls_foods (dataset_id, bls_code, name_de, name_en, notes, source_row)
    select $1::uuid, f.* from jsonb_to_recordset($2::jsonb)
    as f(bls_code text, name_de text, name_en text, notes text, source_row integer)`,
  [datasetId, JSON.stringify(metadata)]);
  await client.query(`
    insert into public.bls_food_nutrients
      (dataset_id, bls_code, nutrient_code, value, raw_value, value_kind, origin, reference_text)
    select $1::uuid, v.* from jsonb_to_recordset($2::jsonb)
    as v(bls_code text, nutrient_code text, value numeric, raw_value text,
         value_kind text, origin text, reference_text text)`, [datasetId, JSON.stringify(values)]);
}

// All operations use the same connected client; a failed import leaves no partial dataset.
export async function importBls(client, source, batchSize = 50) {
  let transaction = false;
  try {
    await source.verifyFiles();
    await client.query('begin'); transaction = true;
    await client.query('select pg_advisory_xact_lock(hashtext($1))', ['makroklar:bls-import']);
    const { manifest, summary } = source;
    const existing = await client.query(`
      select id from public.nutrition_datasets
      where source = $1 and source_version = $2 and release_year = $3 and content_sha256 = $4`,
    [manifest.source, manifest.version, manifest.releaseYear, source.contentHash]);
    if (existing.rows.length) {
      await checkCounts(client, existing.rows[0].id, summary);
      await client.query('rollback'); transaction = false;
      return { status: 'already_imported', datasetId: existing.rows[0].id, ...summary };
    }
    const dataset = await client.query(`
      insert into public.nutrition_datasets
        (source, source_version, release_year, content_sha256, file_manifest, source_url, food_count, nutrient_count)
      values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) returning id`,
    [manifest.source, manifest.version, manifest.releaseYear, source.contentHash,
      JSON.stringify(manifest.files), manifest.sourceUrl, summary.foods, summary.nutrients]);
    const datasetId = dataset.rows[0].id;
    await client.query(`
      insert into public.nutrients
        (dataset_id, code, name_de, name_en, unit, group_de, group_en, formula, formula_application, sort_index)
      select $1::uuid, n.* from jsonb_to_recordset($2::jsonb)
      as n(code text, name_de text, name_en text, unit text, group_de text, group_en text,
           formula text, formula_application text, sort_index integer)`,
    [datasetId, JSON.stringify(source.definitions)]);
    let batch = [];
    for await (const food of source.foods()) {
      batch.push(food);
      if (batch.length >= batchSize) {
        await insertFoodBatch(client, datasetId, batch); batch = [];
      }
    }
    if (batch.length) await insertFoodBatch(client, datasetId, batch);
    await checkCounts(client, datasetId, summary);
    await source.verifyFiles();
    await client.query('update public.nutrition_datasets set is_active = false where source = $1 and is_active', [manifest.source]);
    await client.query('update public.nutrition_datasets set is_active = true where id = $1', [datasetId]);
    await client.query('commit'); transaction = false;
    return { status: 'imported', datasetId, ...summary };
  } catch (error) {
    if (transaction) await client.query('rollback').catch(() => {});
    throw error;
  }
}

export async function connectionConfig(connectionString, projectRef, rootCertificate) {
  if (!connectionString) throw new Error('Set BLS_DATABASE_URL in .env.local for --apply.');
  if (!/^[a-z]{20}$/.test(projectRef ?? '')) throw new Error('Provide --project-ref or link the intended Supabase project first.');
  const url = new URL(connectionString);
  const user = decodeURIComponent(url.username);
  const direct = url.hostname === `db.${projectRef}.supabase.co`;
  const pooler = url.hostname.endsWith('.pooler.supabase.com') && user.endsWith(`.${projectRef}`);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (!direct && !pooler)) {
    throw new Error('BLS_DATABASE_URL does not match the selected Supabase project.');
  }
  for (const [key, value] of url.searchParams) {
    if (key !== 'sslmode' || !['require', 'verify-full'].includes(value)) {
      throw new Error('Only sslmode=require or verify-full is accepted as a connection URL option.');
    }
  }
  if (!user || !url.password || url.pathname.length < 2) throw new Error('Incomplete database connection URL.');
  return {
    host: url.hostname, port: Number(url.port || 5432), user,
    password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)),
    ssl: { rejectUnauthorized: true, ...(rootCertificate ? { ca: await readFile(rootCertificate, 'utf8') } : {}) },
    application_name: 'makroklar-bls-import', connectionTimeoutMillis: 15000,
  };
}

async function main() {
  const { values } = parseArgs({ options: {
    'source-dir': { type: 'string', default: 'BLS' },
    'project-ref': { type: 'string' },
    apply: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('npm run bls:import -- [--source-dir BLS] [--dry-run | --apply] [--project-ref REF]');
    return;
  }
  if (values.apply && values['dry-run']) throw new Error('Choose either --apply or --dry-run.');
  const source = await openBlsSource(resolve(values['source-dir']), manifestPath);
  if (!values.apply) {
    console.log(JSON.stringify({ status: 'validated_only', databaseConnected: false,
      source: source.manifest.source, version: source.manifest.version,
      contentSha256: source.contentHash, ...source.summary }, null, 2));
    return;
  }
  try { loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const projectRef = values['project-ref'] ?? (await readFile(
    new URL('../.temp/project-ref', import.meta.url), 'utf8',
  ).catch(() => '')).trim();
  const config = await connectionConfig(process.env.BLS_DATABASE_URL, projectRef, process.env.BLS_SSL_ROOT_CERT);
  const client = new pg.Client(config);
  try {
    await client.connect();
    console.log(JSON.stringify({ projectRef, ...await importBls(client, source) }, null, 2));
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    // Never log the connection config or an error object containing credentials.
    const message = String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[database URL redacted]');
    console.error(`BLS import failed${error.code ? ` (${error.code})` : ''}: ${message}`);
    process.exitCode = 1;
  });
}
