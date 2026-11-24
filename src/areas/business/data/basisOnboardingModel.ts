import { z } from 'zod';
import { onboardingPayloadSchema, onboardingSnapshotSchema } from './onboardingModel';
import { positiveAmount, recipeErrors } from './recipeDraft';
import type { RecipeFood } from '../types/recipe';

// Prepared contract for the v2 RPCs. No existing UI/save action uses it yet.
const quantity = z.string().trim().max(30).refine(value => positiveAmount(value) !== null,
  'Bitte eine Menge größer als 0 eingeben (maximal 1.000.000).');
const unit = z.enum(['g', 'ml']);
export const basisRecipeSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(500),
  outputQuantity: quantity.nullable(),
  outputUnit: unit,
  ingredients: z.array(z.strictObject({
    foodId: z.string().min(1).max(500), quantity, unit,
  })).max(1000),
});
export type BasisRecipeDraft = z.infer<typeof basisRecipeSchema>;

const basisFields = {
  schemaVersion: z.literal(2),
  basisRecipes: z.array(basisRecipeSchema).max(1000),
  dishBases: z.record(z.string(), z.array(z.strictObject({ basisId: z.uuid(), quantity, unit })).max(1000)),
};
type BasisFields = z.infer<z.ZodObject<typeof basisFields>>;

function checkBasisReferences(value: BasisFields, foods: RecipeFood[], dishKeys: string[], context: z.RefinementCtx) {
  const bases = new Map(value.basisRecipes.map(basis => [basis.id, basis]));
  if (bases.size !== value.basisRecipes.length) {
    context.addIssue({ code: 'custom', path: ['basisRecipes'], message: 'Basisrezepte dürfen nicht doppelt vorkommen.' });
  }
  value.basisRecipes.forEach((basis, index) => {
    for (const message of recipeErrors({ servings: '1', ingredients: basis.ingredients }, foods)) {
      context.addIssue({ code: 'custom', path: ['basisRecipes', index, 'ingredients'], message });
    }
  });
  for (const [key, lines] of Object.entries(value.dishBases)) {
    if (!dishKeys.includes(key)) context.addIssue({ code: 'custom', path: ['dishBases', key], message: 'Das Gericht fehlt.' });
    const seen = new Set<string>();
    for (const line of lines) {
      const basis = bases.get(line.basisId);
      if (!basis || seen.has(line.basisId) || basis.outputUnit !== line.unit) {
        context.addIssue({ code: 'custom', path: ['dishBases', key], message: 'Basisrezept fehlt, ist doppelt oder hat eine andere Einheit.' });
      }
      seen.add(line.basisId);
    }
  }
}

// Full-state client contract. SQL additionally preserves omitted bases/dish keys;
// only explicit deletedBasisIds and explicit [] dish links can remove them.
export const basisOnboardingPayloadSchema = onboardingPayloadSchema.safeExtend({
  ...basisFields,
  deletedBasisIds: z.array(z.uuid()).max(1000),
}).superRefine((value, context) => {
  checkBasisReferences(value, [...value.catalogFoods, ...value.manualFoods].map(food => ({ ...food, sourceLabel: '' })),
    [...value.importedIds.map(id => `lightspeed-k-series-${id}`), ...value.customDishes.map(dish => `manual-${dish.id}`)], context);
  if (new Set(value.deletedBasisIds).size !== value.deletedBasisIds.length
    || value.deletedBasisIds.some(id => value.basisRecipes.some(basis => basis.id === id))) {
    context.addIssue({ code: 'custom', path: ['deletedBasisIds'], message: 'Löschen und Speichern desselben Basisrezepts ist nicht erlaubt.' });
  }
});
export type BasisOnboardingPayload = z.infer<typeof basisOnboardingPayloadSchema>;

export const basisOnboardingSnapshotSchema = onboardingSnapshotSchema.safeExtend(basisFields)
  .superRefine((value, context) => {
    checkBasisReferences(value, [...value.catalogFoods, ...value.manualFoods].map(food => ({ ...food, sourceLabel: '' })),
      Object.keys(value.recipes), context);
  });
export type BasisOnboardingSnapshot = z.infer<typeof basisOnboardingSnapshotSchema>;

/** Return a copy; normalize decimal input before SQL and keep plated dishes at one portion. */
export function normalizeBasisPayload(input: unknown): BasisOnboardingPayload {
  const payload = basisOnboardingPayloadSchema.parse(input);
  const decimal = (value: string) => value.trim().replace(',', '.');
  for (const recipe of Object.values(payload.recipes)) {
    recipe.servings = '1';
    for (const line of recipe.ingredients) line.quantity = decimal(line.quantity);
  }
  for (const basis of payload.basisRecipes) {
    if (basis.outputQuantity !== null) basis.outputQuantity = decimal(basis.outputQuantity);
    for (const line of basis.ingredients) line.quantity = decimal(line.quantity);
  }
  for (const lines of Object.values(payload.dishBases)) for (const line of lines) line.quantity = decimal(line.quantity);
  return payload;
}
