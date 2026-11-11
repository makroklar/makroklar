import { z } from 'zod';
import { normalizeBarcode } from './foodSearchModel';
import { recipeErrors } from './recipeDraft';

const amount = z.number().finite().min(0).max(1_000_000);
const name = z.string().trim().min(1).max(500);
const basis = z.enum(['100g', '100ml']).nullable();
const preparation = z.enum(['as_sold', 'prepared']).nullable();
const macros = { energyKcal: amount.nullable(), proteinG: amount.nullable(), fatG: amount.nullable(), carbohydrateG: amount.nullable() };
export const catalogFoodSchema = z.object({
  id: name, name, detail: z.string().max(2000), basis, preparation, ...macros,
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('bls'), datasetId: z.uuid(), code: name, version: name }),
    z.object({ kind: z.literal('off'), barcode: z.string().regex(/^\d{8,14}$/), fetchedAt: z.iso.datetime(), modifiedAt: z.number().int().nonnegative().nullable() }),
  ]),
}).refine(food => food.id === (food.source.kind === 'bls'
  ? `bls:${food.source.datasetId}:${food.source.code}` : `off:${normalizeBarcode(food.source.barcode)}`))
  .refine(food => food.source.kind !== 'bls' || food.basis === '100g');
export const manualFoodSchema = z.object({
  id: z.uuid(), name, basis: z.enum(['100g','100ml']), preparation: z.enum(['as_sold','prepared']),
  energyKcal: amount, proteinG: amount, fatG: amount, carbohydrateG: amount,
  sourceKind: z.enum(['label','supplier']), sourceDescription: name, noticeVersion: z.literal('2026-11-10.2'),
});
const customDish = z.object({ id: z.uuid(), name, price: amount.max(999999).nullable().refine(value => value === null || Number(value.toFixed(2)) === value) });
const recipe = z.object({ servings: z.string().max(20), ingredients: z.array(z.object({
  foodId: name, quantity: z.string().max(30), unit: z.enum(['g','ml','']),
})).max(1000) });
export const onboardingPayloadSchema = z.object({
  importedIds: z.array(z.number().int().refine(Number.isSafeInteger)).max(1000),
  customDishes: z.array(customDish).max(1000),
  catalogFoods: z.array(catalogFoodSchema).max(1000),
  manualFoods: z.array(manualFoodSchema).max(1000),
  recipes: z.record(z.string(), recipe),
}).superRefine((value, context) => {
  const foods = [...value.catalogFoods, ...value.manualFoods].map(food => ({ ...food, sourceLabel: '' }));
  const keys = [...value.importedIds.map(id => `lightspeed-k-series-${id}`), ...value.customDishes.map(dish => `manual-${dish.id}`)];
  if (new Set(keys).size !== keys.length || new Set(foods.map(food => food.id)).size !== foods.length) {
    context.addIssue({ code: 'custom', message: 'Gerichte und Lebensmittel dürfen nicht doppelt vorkommen.' });
  }
  for (const [key, draft] of Object.entries(value.recipes)) {
    if (!keys.includes(key)) context.addIssue({ code: 'custom', message: 'Ein Rezept gehört zu keinem vorhandenen Gericht.' });
    for (const message of recipeErrors(draft, foods)) context.addIssue({ code: 'custom', path: ['recipes',key], message });
  }
});
export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;

const metricSchema = z.object({
  nutrient_code: z.enum(['ENERCC','PROT625','FAT','CHO']), unit: z.enum(['kcal','g']),
  recipe_total: z.number().finite().nonnegative().nullable(), per_serving: z.number().finite().nonnegative().nullable(), status: z.enum(['complete','incomplete','empty_recipe']),
}).superRefine((metric, context) => {
  if (metric.status === 'complete' ? metric.recipe_total === null || metric.per_serving === null
    : metric.recipe_total !== null || metric.per_serving !== null) {
    context.addIssue({ code: 'custom', message: 'Invalid nutrition result.' });
  }
  if (metric.unit !== (metric.nutrient_code === 'ENERCC' ? 'kcal' : 'g')) context.addIssue({ code: 'custom', message: 'Invalid nutrient unit.' });
});
export const completionSummarySchema = z.object({
  version: z.number().int().positive(), restaurantName: name,
  dishCount: z.number().int().nonnegative(), foodCount: z.number().int().nonnegative(),
  completeCount: z.number().int().nonnegative(), draftCount: z.number().int().nonnegative(),
  dishes: z.array(z.object({ key: name, complete: z.boolean(), metrics: z.array(metricSchema).length(4) })),
}).superRefine((summary, context) => {
  if (summary.dishCount !== summary.dishes.length || summary.draftCount + summary.completeCount !== summary.dishCount
    || summary.completeCount !== summary.dishes.filter(dish => dish.complete).length
    || new Set(summary.dishes.map(dish => dish.key)).size !== summary.dishes.length
    || summary.dishes.some(dish => new Set(dish.metrics.map(metric => metric.nutrient_code)).size !== 4
      || dish.complete !== dish.metrics.every(metric => metric.status === 'complete'))) {
    context.addIssue({ code: 'custom', message: 'Invalid completion summary.' });
  }
});
export type CompletionSummary = z.infer<typeof completionSummarySchema>;

export const onboardingSnapshotSchema = z.object({
  version: z.number().int().nonnegative(), restaurantName: name,
  catalogFoods: z.array(catalogFoodSchema), manualFoods: z.array(manualFoodSchema), customDishes: z.array(customDish),
  recipes: z.record(z.string(), recipe), summary: completionSummarySchema.nullable(),
});
export type OnboardingSnapshot = z.infer<typeof onboardingSnapshotSchema>;
