import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { loadEnvFile } from 'node:process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { connectionConfig } from '../imports/import-bls.mjs';

// Reuse the application's validation without adding a TS runner dependency.
registerHooks({ resolve(specifier, context, next) {
  if (['./foodSearchModel', './recipeDraft'].includes(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { catalogFoodSchema, onboardingSnapshotSchema, onboardingPayloadSchema, completionSummarySchema } =
  await import('../../../areas/business/data/onboardingModel.ts');

export const metrics = { ENERCC: 'energyKcal', PROT625: 'proteinG', FAT: 'fatG', CHO: 'carbohydrateG' };
const fail = message => { throw new Error(`Demo seed: ${message}`); };
export const recipeKey = id => `manual-${id}`;

// Explicitly approved development accounts. Never select all restaurants implicitly.
const approvedRestaurants = new Map([
  ['349b07ad-d552-4c0a-b2ff-8a6ca1ff8d00', 'Dönerladen'],
  ['52bddc5a-2efc-4915-853f-b665dffaef2c', 'PizzaLaden'],
  ['55727717-68c6-404e-a0a7-7db1b1653f41', 'test-max'],
]);

export function checkTarget(manifest, restaurantId, projectRef) {
  if (projectRef !== manifest.projectRef || projectRef !== 'osdbsbbcnftussvgumjh') fail('Unexpected project.');
  const restaurantName = approvedRestaurants.get(restaurantId);
  if (!restaurantName) fail('Only explicitly approved demo restaurants may be changed.');
  return restaurantName;
}

export function existingPilotState(snapshot, manifest) {
  const existing = manifest.dishes.filter(dish => snapshot.customDishes.some(saved => saved.id === dish.id));
  if (existing.length && existing.length !== manifest.dishes.length) fail('Partial pilot found; review manually, no overwrite.');
  return existing.length ? 'already_present' : 'new';
}

export function mergePilot(snapshot, importedIds, manifest, resolvedFoods) {
  if (existingPilotState(snapshot, manifest) !== 'new') fail('Pilot already exists; preserve user edits.');
  const payload = structuredClone({ importedIds, customDishes: snapshot.customDishes,
    catalogFoods: snapshot.catalogFoods, manualFoods: snapshot.manualFoods, recipes: snapshot.recipes });
  const accepted = new Map(payload.catalogFoods.map(food => [food.id, food]));
  const aliases = new Map();
  for (const [alias, resolved] of Object.entries(resolvedFoods)) {
    const food = catalogFoodSchema.parse(accepted.get(resolved.id) ?? resolved);
    aliases.set(alias, food);
    if (!accepted.has(food.id)) { payload.catalogFoods.push(food); accepted.set(food.id, food); }
  }
  for (const dish of manifest.dishes) {
    if (!dish.name.startsWith('Demo · ')) fail('Demo dishes must be visibly labelled.');
    payload.customDishes.push({ id: dish.id, name: dish.name, price: dish.price });
    payload.recipes[recipeKey(dish.id)] = { servings: '1', ingredients: dish.ingredients.map(line => {
      const food = aliases.get(line.food);
      if (!food) fail(`Unresolved food: ${line.food}`);
      return { foodId: food.id, quantity: line.quantity, unit: line.unit };
    }) };
  }
  return onboardingPayloadSchema.parse(payload);
}

// Independent test oracle, never persisted as a fabricated dish total.
export function calculateRecipe(recipe, foods) {
  const byId = new Map(foods.map(food => [food.id, food]));
  return Object.fromEntries(Object.entries(metrics).map(([code, field]) => {
    let sum = 0;
    for (const line of recipe.ingredients) {
      const food = byId.get(line.foodId);
      const value = food?.[field];
      const quantity = Number(line.quantity.replace(',', '.'));
      if (!food || !Number.isFinite(value) || value < 0 || !Number.isFinite(quantity) || quantity <= 0
        || !((food.basis === '100g' && line.unit === 'g') || (food.basis === '100ml' && line.unit === 'ml'))) {
        fail('Nutrition must be complete and quantities must match the source basis.');
      }
      sum += value * quantity / 100;
    }
    return [code, sum];
  }));
}

async function resolveFoods(client, manifest) {
  const dataset = (await client.query('select source_version from public.nutrition_datasets where id=$1 and source=\'bls\' and is_active', [manifest.datasetId])).rows[0];
  if (dataset?.source_version !== manifest.datasetVersion) fail('Pinned BLS dataset is unavailable.');
  const resolved = {};
  for (const [alias, source] of Object.entries(manifest.foods)) {
    let value;
    if (source.kind === 'bls') {
      const row = (await client.query(`select name_de,makroklar_private.bls_food_snapshot(dataset_id,bls_code,name_de) as food
        from public.bls_foods where dataset_id=$1 and bls_code=$2`, [manifest.datasetId, source.code])).rows[0];
      if (row?.name_de !== source.name) fail(`BLS identity/name mismatch for ${alias}.`);
      value = row.food;
    } else if (source.kind === 'off') {
      // Read the provider-only cache, never a different tenant's ingredient data.
      value = (await client.query('select public.read_shared_off_product($1) as food', [source.barcode])).rows[0]?.food;
      if (value?.source?.barcode !== source.barcode || value.name !== source.name) fail(`Fresh verified OFF product missing for ${alias}.`);
    } else fail('Unsupported source. Do not invent nutrition or consent.');
    const food = catalogFoodSchema.parse(value);
    calculateRecipe({ ingredients: [{ foodId: food.id, quantity: '100', unit: food.basis === '100ml' ? 'ml' : 'g' }] }, [food]);
    resolved[alias] = food;
  }
  return resolved;
}

async function otherRestaurantsFingerprint(client, target) {
  const hashes = {};
  for (const table of ['dishes','dish_import_details','restaurant_ingredients','dish_ingredients','restaurant_onboarding']) {
    const result = await client.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) as hash
      from public.${table} t where restaurant_id<>$1`, [target]);
    hashes[table] = result.rows[0].hash;
  }
  return hashes;
}

function comparableRecipe(recipe) {
  return { servings: Number(recipe.servings), ingredients: recipe.ingredients.map(line => ({
    foodId: line.foodId, unit: line.unit, quantity: Number(line.quantity.replace(',', '.')),
  })).sort((a,b) => a.foodId.localeCompare(b.foodId)) };
}

async function readSnapshot(client, restaurantId) {
  return onboardingSnapshotSchema.parse((await client.query('select public.read_restaurant_onboarding($1) as data', [restaurantId])).rows[0].data);
}

async function save(client, restaurantId, payload, version, requestId = randomUUID()) {
  const row = (await client.query('select public.save_restaurant_onboarding($1,$2::jsonb,$3,$4) as data',
    [restaurantId, JSON.stringify(payload), version, requestId])).rows[0];
  return completionSummarySchema.parse(row.data);
}

async function verifyDish(client, restaurantId, dish, payload, summary) {
  const key = recipeKey(dish.id);
  const expected = calculateRecipe(payload.recipes[key], [...payload.catalogFoods, ...payload.manualFoods]);
  const rows = (await client.query(`select n.* from public.dishes d cross join lateral public.get_dish_nutrition(d.id) n
    where d.restaurant_id=$1 and d.client_id=$2`, [restaurantId, dish.id])).rows;
  const saved = summary.dishes.find(entry => entry.key === key);
  if (rows.length !== 4 || !saved?.complete) fail('Demo dish did not calculate completely.');
  for (const row of rows) {
    const metric = saved.metrics.find(item => item.nutrient_code === row.nutrient_code);
    if (row.status !== 'complete' || !metric || Math.abs(Number(row.per_serving) - expected[row.nutrient_code]) > 1e-8
      || Math.abs(metric.per_serving - expected[row.nutrient_code]) > 1e-8) fail('SQL calculation or stored summary differs from ingredient arithmetic.');
  }
  return { name: dish.name, ingredients: payload.recipes[key].ingredients.length,
    totalsPerPortion: Object.fromEntries(Object.entries(expected).map(([k,v]) => [k, Number(v.toFixed(3))])) };
}

async function verifyDynamicChanges(client, restaurantId, manifest, payload, version) {
  const dish = manifest.dishes[0];
  const key = recipeKey(dish.id);
  const first = payload.recipes[key].ingredients[0];
  const extra = payload.recipes[recipeKey(manifest.dishes[2].id)].ingredients[1];
  const changes = {
    doubledQuantity: recipe => { recipe.ingredients[0].quantity = String(Number(first.quantity) * 2); },
    addedIngredient: recipe => { recipe.ingredients.push({ ...extra, quantity: '20' }); },
    removedIngredient: recipe => { recipe.ingredients.shift(); },
  };
  for (const [name, change] of Object.entries(changes)) {
    await client.query('savepoint dynamic_recipe');
    try {
      const modified = structuredClone(payload); change(modified.recipes[key]);
      const summary = await save(client, restaurantId, onboardingPayloadSchema.parse(modified), version);
      await verifyDish(client, restaurantId, dish, modified, summary);
      const restored = await readSnapshot(client, restaurantId);
      assert.deepEqual(comparableRecipe(restored.recipes[key]), comparableRecipe(modified.recipes[key]));
    } finally { await client.query('rollback to savepoint dynamic_recipe'); }
  }
  return Object.keys(changes);
}

export async function seedPilot(client, manifest, { restaurantId, projectRef, apply = false }) {
  const restaurantName = checkTarget(manifest, restaurantId, projectRef);
  await client.query('begin');
  try {
    await client.query("select pg_advisory_xact_lock(hashtextextended('makroklar:onboarding:'||$1,0))", [restaurantId]);
    await client.query("select pg_advisory_xact_lock(hashtextextended('makroklar:lightspeed-import:'||$1,0))", [restaurantId]);
    const target = (await client.query(`select r.name,m.user_id from public.restaurants r join public.restaurant_members m
      on m.restaurant_id=r.id and m.role='owner' where r.id=$1`, [restaurantId])).rows;
    if (target.length !== 1 || target[0].name !== restaurantName) fail('Restaurant owner/name mismatch.');
    const otherBefore = await otherRestaurantsFingerprint(client, restaurantId);
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [target[0].user_id]);
    await client.query('set local role authenticated');
    const snapshot = await readSnapshot(client, restaurantId);
    if (existingPilotState(snapshot, manifest) === 'already_present') {
      await client.query('rollback');
      return { status: 'already_present', restaurant: restaurantName, preservedUserEdits: true };
    }
    const imported = (await client.query("select source_id from public.dishes where restaurant_id=$1 and source='lightspeed-k-series' order by source_id", [restaurantId])).rows.map(row => Number(row.source_id));
    const foods = await resolveFoods(client, manifest);
    const payload = mergePilot(snapshot, imported, manifest, foods);
    const requestId = randomUUID();
    const summary = await save(client, restaurantId, payload, snapshot.version, requestId);
    assert.deepEqual(await save(client, restaurantId, payload, snapshot.version, requestId), summary);
    const results = [];
    for (const dish of manifest.dishes) results.push(await verifyDish(client, restaurantId, dish, payload, summary));
    const dynamicChecks = await verifyDynamicChanges(client, restaurantId, manifest, payload, summary.version);
    const restored = await readSnapshot(client, restaurantId);
    for (const dish of snapshot.customDishes) assert.deepEqual(restored.customDishes.find(item => item.id === dish.id), dish);
    for (const food of [...snapshot.catalogFoods, ...snapshot.manualFoods]) {
      assert.deepEqual([...restored.catalogFoods, ...restored.manualFoods].find(item => item.id === food.id), food);
    }
    for (const [key, recipe] of Object.entries(snapshot.recipes)) assert.deepEqual(comparableRecipe(restored.recipes[key]), comparableRecipe(recipe));
    for (const dish of manifest.dishes) assert.deepEqual(comparableRecipe(restored.recipes[recipeKey(dish.id)]), comparableRecipe(payload.recipes[recipeKey(dish.id)]));
    assert.equal(restored.customDishes.length, snapshot.customDishes.length + manifest.dishes.length);
    assert.deepEqual(restored.summary, summary);
    await client.query('reset role');
    assert.deepEqual(await otherRestaurantsFingerprint(client, restaurantId), otherBefore);
    await client.query(apply ? 'commit' : 'rollback');
    return { status: apply ? 'applied' : 'validated_and_rolled_back', restaurant: restaurantName,
      addedDishes: manifest.dishes.length, totalDishes: summary.dishCount, completeDishes: summary.completeCount,
      foods: summary.foodCount, preservedExistingRecipes: true, otherRestaurantsUnchanged: true,
      idempotentSaveChecked: true, dynamicChecks, dishes: results };
  } catch (error) { await client.query('rollback'); throw error; }
}

async function main() {
  const { values } = parseArgs({ options: { 'restaurant-id': { type: 'string' }, apply: { type: 'boolean', default: false } } });
  const manifest = JSON.parse(await readFile(new URL('./restaurant-demo-pilot.json', import.meta.url), 'utf8'));
  const projectRef = (await readFile(new URL('../.temp/project-ref', import.meta.url), 'utf8')).trim();
  checkTarget(manifest, values['restaurant-id'], projectRef);
  loadEnvFile('.env.local');
  const client = new pg.Client({ ...await connectionConfig(process.env.BLS_DATABASE_URL, projectRef, process.env.BLS_SSL_ROOT_CERT),
    application_name: 'makroklar-demo-pilot', statement_timeout: 30000, lock_timeout: 5000 });
  try {
    await client.connect();
    console.log(JSON.stringify(await seedPilot(client, manifest, { restaurantId: values['restaurant-id'], projectRef, apply: values.apply }), null, 2));
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message?.startsWith('Demo seed:') ? error.message : `Demo seed failed (${error.code ?? 'validation_or_connection'}). No credentials printed.`);
    process.exitCode = 1;
  });
}
