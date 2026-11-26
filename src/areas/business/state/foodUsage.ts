import type { BasisRecipeDraft } from '../data/basisOnboardingModel';
import type { ImportedMenuItem } from '../types/importedMenuItem';
import type { CustomDishDraft, RecipeDraft } from '../types/recipe';

export interface FoodUsage { kind: 'dish' | 'basis'; id: string; name: string }
export type FoodUsageIndex = ReadonlyMap<string, readonly FoodUsage[]>;

/** Direct references only: removing a dish's basis link does not remove foods from that basis. */
export function buildFoodUsageIndex(input: {
  recipes: Readonly<Record<string, RecipeDraft>>;
  basisRecipes: readonly BasisRecipeDraft[];
  importedItems: readonly ImportedMenuItem[];
  customDishes: readonly CustomDishDraft[];
}): FoodUsageIndex {
  const usages = new Map<string, FoodUsage[]>();
  const dishNames = new Map<string, string>([
    ...input.importedItems.map(item => [`${item.source}-${item.sourceId}`, item.name] as const),
    ...input.customDishes.map(item => [`manual-${item.id}`, item.name] as const),
  ]);
  function add(ingredients: readonly { foodId: string }[], usage: FoodUsage) {
    // Incomplete quantities still reference a food; duplicate lines count as one recipe.
    for (const foodId of new Set(ingredients.map(line => line.foodId))) {
      usages.set(foodId, [...(usages.get(foodId) ?? []), usage]);
    }
  }
  for (const [id, recipe] of Object.entries(input.recipes)) {
    add(recipe.ingredients, { kind: 'dish', id, name: dishNames.get(id)?.trim() || `Gericht (${id})` });
  }
  for (const basis of input.basisRecipes) {
    add(basis.ingredients, { kind: 'basis', id: basis.id, name: basis.name.trim() || 'Basisrezept ohne Namen' });
  }
  return usages;
}

/** Return the same array when blocked so callers also preserve dirty/saved state. */
export function removeUnusedFood<T extends { id: string }>(
  foods: T[], id: string, usages: FoodUsageIndex, canRemove: boolean,
): T[] {
  if (!canRemove || usages.get(id)?.length || !foods.some(food => food.id === id)) return foods;
  return foods.filter(food => food.id !== id);
}
