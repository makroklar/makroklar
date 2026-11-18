import { z } from 'zod';
import type { RecipeDraft, RecipeFood } from '../types/recipe';

export const newDishSchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.string().trim().transform(value => value === '' ? null : value)
    .pipe(z.union([z.null(), z.string().regex(/^\d+(?:[.,]\d{1,2})?$/)
      .transform(value => Number(value.replace(',', '.'))).pipe(z.number().finite().min(0).max(999999))])),
});

export const defaultRecipe = (): RecipeDraft => ({ servings: '1', ingredients: [] });

export function positiveAmount(value: string): number | null {
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return null;
  const amount = Number(value.trim().replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000 ? amount : null;
}

export function recipeErrors(recipe: RecipeDraft, foods: readonly RecipeFood[]): string[] {
  const errors: string[] = [];
  if (!/^\d+$/.test(recipe.servings.trim()) || !positiveAmount(recipe.servings)) errors.push('Bitte eine ganze Anzahl Portionen ab 1 eingeben.');
  const seen = new Set<string>();
  for (const line of recipe.ingredients) {
    const food = foods.find(item => item.id === line.foodId);
    if (!food) { errors.push('Eine zugeordnete Zutat fehlt in deiner Lebensmittelliste. Bitte erneut hinzufügen oder aus dem Rezept entfernen.'); continue; }
    if (seen.has(line.foodId)) errors.push(`${food.name}: Bitte nur einmal zuordnen und die Gesamtmenge angeben.`);
    seen.add(line.foodId);
    if (positiveAmount(line.quantity) === null) errors.push(`${food.name}: Bitte eine Menge größer als 0 eingeben (maximal 1.000.000).`);
    if (!['g', 'ml'].includes(line.unit) || (food.basis === '100g' && line.unit !== 'g') || (food.basis === '100ml' && line.unit !== 'ml')) {
      errors.push(`${food.name}: Bitte die Einheit passend zur Nährwertbasis auswählen.`);
    }
  }
  return errors;
}
