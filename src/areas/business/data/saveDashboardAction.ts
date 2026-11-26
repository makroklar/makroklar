'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { finishOnboarding } from './finishOnboardingAction';
import { readOnboarding } from './readOnboarding';
import { getMenuSession, readSavedMenu } from './savedMenu';
import { catalogFoodSchema, manualFoodSchema } from './onboardingModel';
import type { BasisOnboardingPayload } from './basisOnboardingModel';
import { manualFoodNoticeVersion } from './manualFood';
import { basisKey, getRestaurantData, manualKey } from './restaurantData';

// Änderungen aus dem Dashboard laufen über denselben geprüften Speicherweg wie das Onboarding
// (save_restaurant_onboarding_v2): aktueller Stand laden, eine Stelle ändern, alles zurückschreiben.
// Basisrezepte und ihre Verknüpfungen werden unverändert mitgeschickt, damit nichts verloren geht.

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

async function currentPayload(): Promise<{ payload: BasisOnboardingPayload; version: number } | { error: string }> {
  const [menu, onboarding] = await Promise.all([readSavedMenu(), readOnboarding()]);
  if (menu.error || onboarding.error) return { error: menu.error ?? onboarding.error ?? 'Deine Daten konnten nicht geladen werden.' };
  const snapshot = onboarding.snapshot;
  const basis = snapshot && 'schemaVersion' in snapshot ? snapshot : null;
  const importedIds = menu.items.map(item => item.sourceId);
  const customDishes = snapshot?.customDishes ?? [];
  const dishKeys = new Set([...importedIds.map(id => `lightspeed-k-series-${id}`), ...customDishes.map(dish => manualKey(dish.id))]);
  return {
    version: snapshot?.version ?? 0,
    payload: {
      schemaVersion: 2,
      importedIds,
      customDishes,
      catalogFoods: snapshot?.catalogFoods ?? [],
      manualFoods: snapshot?.manualFoods ?? [],
      recipes: structuredClone(snapshot?.recipes ?? {}),
      basisRecipes: structuredClone(basis?.basisRecipes ?? []),
      // Nicht mitgeschickte Gerichte behalten ihre Verknüpfungen (siehe save_restaurant_onboarding_v2).
      dishBases: Object.fromEntries(Object.entries(structuredClone(basis?.dishBases ?? {})).filter(([key]) => dishKeys.has(key))),
      deletedBasisIds: [],
    },
  };
}

async function save(payload: BasisOnboardingPayload, version: number, key: string): Promise<DashboardSaveResult> {
  const result = await finishOnboarding({ payload, version, requestId: randomUUID() });
  return result.status === 'saved' ? { status: 'saved', key } : result;
}

/** Neu gesuchte Lebensmittel übernehmen; prüft, dass jede Zeile ein bekanntes Lebensmittel hat. */
function addFoods(payload: BasisOnboardingPayload, newFoods: z.infer<typeof catalogFoodSchema>[], lines: { foodId: string }[]) {
  const known = new Set([...payload.catalogFoods, ...payload.manualFoods].map(food => food.id));
  for (const food of newFoods) {
    if (!known.has(food.id)) { payload.catalogFoods = [...payload.catalogFoods, food]; known.add(food.id); }
  }
  return lines.some(entry => !known.has(entry.foodId))
    ? { status: 'error' as const, message: 'Eine Zutat fehlt in deiner Lebensmittelliste. Bitte wähle sie erneut aus.' }
    : null;
}

type Line = { foodId: string; quantity: string; unit: string };

/** Gleiche Zutaten und Mengen? Reihenfolge und Schreibweise (1,5 / 1.5) zählen nicht. */
function sameLines(before: readonly Line[], after: readonly Line[]): boolean {
  const normal = (lines: readonly Line[]) => lines
    .map(entry => `${entry.foodId}|${Number(entry.quantity.replace(',', '.'))}|${entry.unit}`).sort().join(';');
  return normal(before) === normal(after);
}

/**
 * Rezept hat sich geändert: Prüfung, Allergen-Bestätigung und Veröffentlichung aufheben
 * (reset_dish_confirmations). Schlägt das fehl, bleibt das Rezept trotzdem gespeichert.
 */
async function resetConfirmations(keys: readonly string[]) {
  if (keys.length === 0) return;
  try {
    const [session, { dishes }] = await Promise.all([getMenuSession(), getRestaurantData()]);
    const ids = dishes.filter(dish => keys.includes(dish.slug) && (dish.allergensConfirmed || dish.published))
      .flatMap(dish => dish.dishId ? [dish.dishId] : []);
    for (const id of ids) await session.supabase.rpc('reset_dish_confirmations', { target_dish_id: id });
  } catch {
    console.warn('[Dashboard] Freigabe konnte nach einer Rezeptänderung nicht zurückgesetzt werden.');
  }
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

  const missingFood = addFoods(payload, newFoods, lines);
  if (missingFood) return missingFood;

  const changed = !newDish && !sameLines(payload.recipes[key]?.ingredients ?? [], lines);
  // Leere Liste statt Löschen: nur so entfernt die Datenbank auch die gespeicherten Zutaten.
  payload.recipes[key] = { servings: '1', ingredients: lines };
  const result = await save(payload, version, key);
  if (result.status === 'saved' && changed) await resetConfirmations([key]);
  return result;
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

const basisInput = z.object({
  /** ID eines vorhandenen Basisrezepts; fehlt bei einer neuen Basis */
  id: z.uuid().optional(),
  newBasis: z.object({ name: z.string().trim().min(1).max(500) }).optional(),
  lines: z.array(line).max(1000),
  newFoods: z.array(catalogFoodSchema).max(100),
  /** Gewogenes Endgewicht der ganzen Zubereitung; null = noch nicht gewogen */
  cookedWeight: z.string().trim().min(1).max(30).nullable(),
}).refine(value => (value.id === undefined) !== (value.newBasis === undefined));

/** „Basis abwiegen“ / „Neue Basis“: Zutaten und gekochtes Endgewicht eines Basisrezepts speichern */
export async function saveBasis(input: unknown): Promise<DashboardSaveResult> {
  const parsed = basisInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Bitte prüfe Name, Zutaten, Mengen und das gekochte Gewicht.' };
  const current = await currentPayload();
  if ('error' in current) return { status: 'error', message: current.error };
  const { payload, version } = current;
  const { id: existingId, newBasis, lines, newFoods, cookedWeight } = parsed.data;

  const existing = payload.basisRecipes.find(basis => basis.id === existingId);
  if (existingId && !existing) return { status: 'error', message: 'Diese Basis wurde nicht gefunden. Bitte lade die Seite neu.' };
  const missingFood = addFoods(payload, newFoods, lines);
  if (missingFood) return missingFood;

  const basis = existing
    ? { ...existing, ingredients: lines, outputQuantity: cookedWeight }
    : { id: randomUUID(), name: newBasis!.name, outputUnit: 'g' as const, ingredients: lines, outputQuantity: cookedWeight };
  payload.basisRecipes = existing
    ? payload.basisRecipes.map(item => item.id === basis.id ? basis : item)
    : [...payload.basisRecipes, basis];
  const changed = existing !== undefined && (existing.outputQuantity !== cookedWeight || !sameLines(existing.ingredients, lines));
  const result = await save(payload, version, basisKey(basis.id));
  // Gerichte, die diese Basis verwenden, müssen neu geprüft werden.
  if (result.status === 'saved' && changed) {
    await resetConfirmations(Object.entries(payload.dishBases)
      .filter(([, links]) => links.some(link => link.basisId === basis.id)).map(([key]) => key));
  }
  return result;
}
