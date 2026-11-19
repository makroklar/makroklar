'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { finishOnboarding } from './finishOnboardingAction';
import { readOnboarding } from './readOnboarding';
import { readSavedMenu } from './savedMenu';
import { catalogFoodSchema, manualFoodSchema, type OnboardingPayload } from './onboardingModel';
import { manualFoodNoticeVersion } from './manualFood';
import { manualKey } from './restaurantData';

// Änderungen aus dem Dashboard laufen über denselben geprüften Speicherweg wie das Onboarding
// (save_restaurant_onboarding): aktueller Stand laden, eine Stelle ändern, alles zurückschreiben.

export type DashboardSaveResult = { status: 'saved'; key: string } | { status: 'error'; message: string };

const line = z.object({
  foodId: z.string().min(1),
  quantity: z.string().trim().min(1).max(30),
  unit: z.enum(['g', 'ml']),
});

const dishInput = z.object({
  /** Vorhandenes Gericht; fehlt bei einem neuen Gericht */
  key: z.string().min(1).optional(),
  newDish: z.object({ name: z.string().trim().min(1).max(200), price: z.number().min(0).max(999999).nullable() }).optional(),
  lines: z.array(line).max(1000),
  newFoods: z.array(catalogFoodSchema).max(100),
}).refine(value => (value.key === undefined) !== (value.newDish === undefined));

async function currentPayload(): Promise<{ payload: OnboardingPayload; version: number } | { error: string }> {
  const [menu, onboarding] = await Promise.all([readSavedMenu(), readOnboarding()]);
  if (menu.error || onboarding.error) return { error: menu.error ?? onboarding.error ?? 'Deine Daten konnten nicht geladen werden.' };
  const snapshot = onboarding.snapshot;
  return {
    version: snapshot?.version ?? 0,
    payload: {
      importedIds: menu.items.map(item => item.sourceId),
      customDishes: snapshot?.customDishes ?? [],
      catalogFoods: snapshot?.catalogFoods ?? [],
      manualFoods: snapshot?.manualFoods ?? [],
      recipes: structuredClone(snapshot?.recipes ?? {}),
    },
  };
}

async function save(payload: OnboardingPayload, version: number, key: string): Promise<DashboardSaveResult> {
  const result = await finishOnboarding({ payload, version, requestId: randomUUID() });
  return result.status === 'saved' ? { status: 'saved', key } : result;
}

export async function saveDish(input: unknown): Promise<DashboardSaveResult> {
  const parsed = dishInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Bitte prüfe Name, Zutaten und Mengen.' };
  const current = await currentPayload();
  if ('error' in current) return { status: 'error', message: current.error };
  const { payload, version } = current;
  const { key: existingKey, newDish, lines, newFoods } = parsed.data;

  let key = existingKey;
  if (newDish) {
    const id = randomUUID();
    payload.customDishes = [...payload.customDishes, { id, name: newDish.name, price: newDish.price }];
    key = manualKey(id);
  }
  const knownDish = payload.importedIds.some(id => `lightspeed-k-series-${id}` === key)
    || payload.customDishes.some(dish => manualKey(dish.id) === key);
  if (!key || !knownDish) return { status: 'error', message: 'Dieses Gericht wurde nicht gefunden. Bitte lade die Seite neu.' };

  const known = new Set([...payload.catalogFoods, ...payload.manualFoods].map(food => food.id));
  for (const food of newFoods) {
    if (!known.has(food.id)) { payload.catalogFoods = [...payload.catalogFoods, food]; known.add(food.id); }
  }
  if (lines.some(entry => !known.has(entry.foodId))) {
    return { status: 'error', message: 'Eine Zutat fehlt in deiner Lebensmittelliste. Bitte wähle sie erneut aus.' };
  }

  if (lines.length === 0) delete payload.recipes[key];
  else payload.recipes[key] = { servings: '1', ingredients: lines };
  return save(payload, version, key);
}

const manualInput = manualFoodSchema.omit({ id: true, noticeVersion: true });

/** „Neues Produkt“: Lebensmittel mit eigenen Nährwerten anlegen */
export async function saveManualFood(input: unknown): Promise<DashboardSaveResult> {
  const parsed = manualInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Bitte prüfe die Angaben zum Lebensmittel.' };
  const current = await currentPayload();
  if ('error' in current) return { status: 'error', message: current.error };
  const { payload, version } = current;
  const id = randomUUID();
  payload.manualFoods = [...payload.manualFoods, { ...parsed.data, id, noticeVersion: manualFoodNoticeVersion }];
  return save(payload, version, id);
}
