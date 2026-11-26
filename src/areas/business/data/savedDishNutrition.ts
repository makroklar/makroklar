import type { CompletionSummary } from './onboardingModel';

const nutrientLabels = [
  ['ENERCC', 'Energie', 'kcal'],
  ['PROT625', 'Eiweiß', 'g'],
  ['FAT', 'Fett', 'g'],
  ['CHO', 'Kohlenhydrate', 'g'],
] as const;

type SavedNutritionView =
  | { status: 'error' | 'pending' | 'unsaved'; message: string }
  | { status: 'saved'; message: string; rows: { code: string; label: string; unit: string; value: number | null }[] };

/** Display server results only. Any unsaved recipe/food/basis edit invalidates the preview conservatively. */
export function getSavedDishNutrition(input: {
  summary: CompletionSummary | null; dishId: string; version: number;
  hasUnsavedChanges: boolean; readError: string | null;
}): SavedNutritionView {
  if (input.readError) return { status: 'error', message: 'Die gespeicherten Nährwerte konnten nicht bestätigt werden. Bitte lade die gespeicherten Daten erneut.' };
  if (input.hasUnsavedChanges || (input.summary && input.summary.version !== input.version)) {
    return { status: 'pending', message: 'Die Rezeptdaten wurden geändert. Bitte wähle „Einrichtung abschließen“, um sie zu speichern und die Nährwerte neu zu berechnen.' };
  }
  const dish = input.summary?.dishes.find(item => item.key === input.dishId);
  if (!dish) return { status: 'unsaved', message: 'Für dieses Gericht liegt noch keine gespeicherte Berechnung vor. Schließe die Einrichtung ab, um die Nährwerte zu berechnen.' };
  return { status: 'saved', message: dish.complete ? 'Berechnet beim letzten erfolgreichen Speichern.'
    : 'Entwurf: Die Berechnung ist unvollständig. Prüfe Zutaten, Nährwertangaben und die Nettomengen deiner Basisrezepte. Fehlende Werte werden nicht als 0 gewertet.',
  rows: nutrientLabels.map(([code, label, unit]) => {
    const metric = dish.metrics.find(item => item.nutrient_code === code);
    return { code, label, unit, value: metric?.status === 'complete' ? metric.per_serving : null };
  }) };
}

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
export function formatNutritionValue(value: number | null): string {
  if (value === null) return 'Nicht verfügbar';
  if (value > 0 && value < 0.01) return '< 0,01';
  return number.format(value);
}
