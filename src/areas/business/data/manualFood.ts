import { z } from 'zod';
import type { ManualFood } from '../types/manualFood';

export const manualFoodNoticeVersion = '2026-11-10.2';

const nutrient = z.string().trim().regex(/^\d+(?:[.,]\d+)?$/)
  .transform(value => Number(value.replace(',', '.')))
  .pipe(z.number().nonnegative());

const manualFoodInput = z.object({
  name: z.string().trim().min(1),
  basis: z.enum(['100g', '100ml']),
  preparation: z.enum(['as_sold', 'prepared']),
  sourceKind: z.enum(['label', 'supplier']),
  sourceDescription: z.string().trim().min(1),
  energyKcal: nutrient,
  proteinG: nutrient,
  fatG: nutrient,
  carbohydrateG: nutrient,
  consent: z.literal('on'),
});

export type ManualFoodErrors = Partial<Record<keyof ManualFood | 'consent', string>>;
export type ManualFoodValidation =
  | { success: true; food: ManualFood }
  | { success: false; errors: ManualFoodErrors };

export function validateManualFood(form: FormData): ManualFoodValidation {
  const result = manualFoodInput.safeParse(Object.fromEntries(
    Object.keys(manualFoodInput.shape).map(key => [key, form.get(key)]),
  ));
  if (result.success) {
    const { consent, ...food } = result.data;
    return { success: true, food };
  }
  const errors: ManualFoodErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof ManualFoodErrors;
    errors[field] = field === 'consent'
      ? 'Bitte bestätige, dass du deine Angaben geprüft hast.'
      : ['energyKcal', 'proteinG', 'fatG', 'carbohydrateG'].includes(field)
      ? 'Bitte einen Wert ab 0 eingeben. Fehlende Werte nicht als 0 eintragen.'
      : 'Bitte dieses Feld ausfüllen oder eine gültige Option auswählen.';
  }
  return { success: false, errors };
}
