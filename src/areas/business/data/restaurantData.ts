import { cache } from 'react';
import { readOnboarding } from './readOnboarding';
import { getMenuSession, readSavedMenu } from './savedMenu';
import type { CompletionSummary, OnboardingSnapshot } from './onboardingModel';
import type { BasisOnboardingSnapshot, BasisRecipeDraft } from './basisOnboardingModel';
import type { ImportedMenuItem } from '../types/importedMenuItem';
import {
  FALLBACK_RESTAURANT_NAME, TASK_TEMPLATES,
  type Ingredient, type Nutrition, type Progress, type Recipe, type Task, type TaskId,
} from './dashboardModel';

// Echte Restaurantdaten für das Dashboard. Quelle sind die importierten Kassenartikel (dishes +
// dish_import_details) und der gespeicherte Onboarding-Stand (Rezepte, Lebensmittel, Nährwerte).

export interface RestaurantFood {
  id: string;
  name: string;
  supplier: string;
  basis: '100g' | '100ml' | null;
}

export interface RestaurantData {
  restaurantName: string;
  /** false, wenn die Status-Felder (Allergene, veröffentlicht) nicht gelesen werden konnten */
  statusAvailable: boolean;
  dishes: Recipe[];
  /** Basisrezepte (Saucen, Teige …) aus dem Onboarding-Stand v2 */
  bases: Recipe[];
  foods: RestaurantFood[];
  importedCount: number;
  error: string | null;
}

type Snapshot = OnboardingSnapshot | BasisOnboardingSnapshot;
type Food = Snapshot['catalogFoods'][number] | Snapshot['manualFoods'][number];

export const importedKey = (sourceId: number) => `lightspeed-k-series-${sourceId}`;
export const manualKey = (id: string) => `manual-${id}`;
export const basisKey = (id: string) => `basis-${id}`;
export const basisIdFromKey = (key: string) => key.startsWith('basis-') ? key.slice('basis-'.length) : null;

function supplierLabel(food: Food): string {
  if ('sourceKind' in food) return `Eigene Angabe · ${food.sourceDescription}`;
  return food.source.kind === 'bls' ? 'Bundeslebensmittelschlüssel (BLS)' : 'Open Food Facts';
}

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

function nutritionFrom(summary: CompletionSummary | null, key: string): Nutrition | undefined {
  const entry = summary?.dishes.find(dish => dish.key === key);
  if (!entry?.complete) return undefined;
  const value = (code: string) => entry.metrics.find(metric => metric.nutrient_code === code)?.per_serving ?? 0;
  const fatG = value('FAT');
  const proteinG = value('PROT625');
  return {
    energyKcal: Math.round(value('ENERCC')),
    fatG: round(fatG),
    carbohydrateG: round(value('CHO')),
    proteinG: round(proteinG),
    fpe: round((fatG * 9 + proteinG * 4) / 100),
  };
}

function missingText(ingredients: Ingredient[], nutrition: Nutrition | undefined): string | null {
  if (nutrition) return null;
  if (ingredients.length === 0) return 'Zutaten fehlen';
  return 'Nährwerte unvollständig';
}

const toNumber = (value: string) => {
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
};

function toIngredients(lines: readonly { foodId: string; quantity: string; unit: string }[], foods: Map<string, Food>): Ingredient[] {
  return lines.flatMap(line => {
    const food = foods.get(line.foodId);
    if (!food) return [];
    return [{
      id: line.foodId,
      foodId: line.foodId,
      name: food.name,
      supplier: supplierLabel(food),
      quantity: toNumber(line.quantity),
      unit: line.unit === 'ml' || food.basis === '100ml' ? 'ml' as const : 'g' as const,
      basis: food.basis,
    }];
  });
}

/** Basisrezept als Recipe. Das gekochte Gewicht ist die gemessene Nettomenge (outputQuantity). */
function buildBasis(basis: BasisRecipeDraft, usedInDishes: number, foods: Map<string, Food>): Recipe {
  const ingredients = toIngredients(basis.ingredients, foods);
  const cookedWeight = basis.outputQuantity === null ? null : toNumber(basis.outputQuantity);
  return {
    slug: basisKey(basis.id),
    kind: 'basis',
    name: basis.name,
    category: 'Basis',
    source: 'Eigene Basis',
    ingredients,
    usedInDishes,
    cookedWeight,
    onMenu: false,
    missing: ingredients.length === 0 ? 'Zutaten fehlen' : cookedWeight === null ? 'Gekochtes Gewicht fehlt' : null,
  };
}

/** Freigabe-Status eines Gerichts aus der Tabelle dishes */
interface DishStatus {
  dishId: string;
  allergens: string[];
  additives: string[];
  allergensConfirmed: boolean;
  published: boolean;
}

/** Status aller Gerichte, Schlüssel wie im Onboarding-Stand. null = nicht lesbar. */
async function readDishStatus(): Promise<Map<string, DishStatus> | null> {
  try {
    const session = await getMenuSession();
    if (!session.restaurantId) return null;
    const { data, error } = await session.supabase.from('dishes')
      .select('id,source,source_id,client_id,allergens,additives,allergens_confirmed_at,published_at')
      .eq('restaurant_id', session.restaurantId);
    if (error) return null;
    return new Map(data.flatMap(row => {
      const key = row.source ? `${row.source}-${row.source_id}` : row.client_id ? manualKey(row.client_id) : null;
      return key ? [[key, {
        dishId: row.id, allergens: row.allergens, additives: row.additives,
        allergensConfirmed: row.allergens_confirmed_at !== null, published: row.published_at !== null,
      }] as const] : [];
    }));
  } catch {
    return null;
  }
}

function buildDish(
  key: string,
  base: Pick<Recipe, 'name' | 'category' | 'source' | 'price' | 'priceFromPos'>,
  snapshot: Snapshot | null,
  foods: Map<string, Food>,
  statuses: Map<string, DishStatus> | null,
): Recipe {
  const status = statuses?.get(key);
  const ingredients = toIngredients(snapshot?.recipes[key]?.ingredients ?? [], foods);
  const nutrition = nutritionFrom(snapshot?.summary ?? null, key);
  return {
    slug: key,
    kind: 'dish',
    ...base,
    ingredients,
    cookedWeight: null,
    portion: { size: 1, unit: 'Portion' },
    nutrition,
    // Ohne lesbaren Status (z. B. Datenbankfehler) zählt ein Gericht mit vollständigen Nährwerten als live.
    onMenu: statuses ? status?.published === true : nutrition !== undefined,
    dishId: status?.dishId,
    allergens: status?.allergens ?? [],
    additives: status?.additives ?? [],
    allergensConfirmed: status?.allergensConfirmed ?? false,
    published: status?.published ?? false,
    missing: missingText(ingredients, nutrition),
  };
}

function importedDish(item: ImportedMenuItem, snapshot: Snapshot | null, foods: Map<string, Food>, statuses: Map<string, DishStatus> | null) {
  return buildDish(importedKey(item.sourceId), {
    name: item.name,
    category: item.accountingGroup?.name ?? 'Ohne Kategorie',
    source: 'Kassensystem (Lightspeed)',
    price: item.selectedPriceIndex === null ? undefined : item.prices[item.selectedPriceIndex]?.amount,
    priceFromPos: true,
  }, snapshot, foods, statuses);
}

/** Name aus der Tabelle restaurants (falls das Onboarding noch nicht gespeichert wurde) */
async function readRestaurantName(): Promise<string | null> {
  try {
    const session = await getMenuSession();
    if (!session.restaurantId) return null;
    const { data } = await session.supabase.from('restaurants').select('name').eq('id', session.restaurantId).maybeSingle();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

export const getRestaurantData = cache(async (): Promise<RestaurantData> => {
  const [menu, onboarding, statuses] = await Promise.all([readSavedMenu(), readOnboarding(), readDishStatus()]);
  const snapshot = onboarding.snapshot;
  const foodList: Food[] = [...(snapshot?.catalogFoods ?? []), ...(snapshot?.manualFoods ?? [])];
  const foods = new Map(foodList.map(food => [food.id, food]));

  const dishes = [
    ...menu.items.map(item => importedDish(item, snapshot, foods, statuses)),
    ...(snapshot?.customDishes ?? []).map(dish => buildDish(manualKey(dish.id), {
      name: dish.name,
      category: 'Eigene Gerichte',
      source: 'Manuell angelegt',
      price: dish.price ?? undefined,
    }, snapshot, foods, statuses)),
  ];

  const v2 = snapshot && 'schemaVersion' in snapshot ? snapshot : null;
  const usage = (id: string) => Object.values(v2?.dishBases ?? {}).filter(lines => lines.some(line => line.basisId === id)).length;
  const bases = (v2?.basisRecipes ?? []).map(basis => buildBasis(basis, usage(basis.id), foods));

  return {
    restaurantName: snapshot?.restaurantName ?? await readRestaurantName() ?? FALLBACK_RESTAURANT_NAME,
    statusAvailable: statuses !== null,
    dishes,
    bases,
    foods: foodList
      .map(food => ({ id: food.id, name: food.name, supplier: supplierLabel(food), basis: food.basis }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    importedCount: menu.items.length,
    error: menu.error ?? onboarding.error,
  };
});

export async function getRecipe(slug: string): Promise<Recipe | undefined> {
  const { dishes, bases } = await getRestaurantData();
  return [...dishes, ...bases].find(recipe => recipe.slug === slug);
}

/**
 * Die vier Aufgaben der To-do-Liste. Jede Aufgabe ist eine Filterregel über die Rezepte;
 * neue Datenquellen (z. B. Basen, „geprüft“- oder „veröffentlicht“-Merker) ändern nur diese Regeln
 * und setzen `available` auf true.
 */
export async function getTasks(): Promise<Task[]> {
  const { dishes, bases } = await getRestaurantData();
  const task = (id: TaskId, items: Recipe[], total: number, done: number, available = true): Task =>
    ({ ...TASK_TEMPLATES[id], items: items.map(recipe => recipe.slug), open: items.length, total, done, available });

  const incomplete = dishes.filter(dish => dish.missing !== null);
  const ready = dishes.filter(dish => dish.nutrition !== undefined);
  const unweighed = bases.filter(basis => basis.missing !== null);
  return [
    // Braucht einen „Rezept geprüft“-Merker pro Gericht; bis dahin keine Einträge.
    task('import-pruefen', [], 0, 0, false),
    // Offen: Basen ohne Zutaten oder ohne gewogenes Endgewicht
    task('basis-abwiegen', unweighed, bases.length, bases.length - unweighed.length),
    task('gerichte-einrichten', incomplete, dishes.length, dishes.length - incomplete.length),
    // Erledigt = veröffentlicht. Offen = fertige Nährwerte, aber noch nicht veröffentlicht.
    task('lmiv-freigabe', ready.filter(dish => !dish.published), dishes.length,
      dishes.filter(dish => dish.published).length),
  ];
}

/**
 * Fortschritt der Einrichtung: Speisekarte importieren und die vier Aufgaben abarbeiten.
 * Jeder Schritt zählt gleich viel; Aufgaben zählen anteilig (erledigte / alle Einträge).
 * Aufgaben, für die es noch keine Daten in der Datenbank gibt, zählen nicht mit.
 */
export async function getProgress(): Promise<Progress> {
  const [{ dishes }, tasks] = await Promise.all([getRestaurantData(), getTasks()]);
  if (dishes.length === 0) return { percent: 0, text: 'Importiere zuerst deine Speisekarte.' };

  const steps = tasks.filter(entry => entry.available);
  const done = (entry: Task) => entry.total === 0 ? 1 : entry.done / entry.total;
  // Speisekarte importiert = erster Schritt erledigt
  const percent = Math.floor(((1 + steps.reduce((sum, entry) => sum + done(entry), 0)) / (steps.length + 1)) * 100);

  const next = steps.find(entry => entry.open > 0 && entry.items.length > 0)
    ?? steps.find(entry => done(entry) < 1);
  const text = !next
    ? 'Alles erledigt – deine Speisekarte ist bereit für deine Gäste!'
    : next.items.length > 0
      ? `Speisekarte importiert. Als Nächstes: ${next.title} (${next.open} offen).`
      : `Speisekarte importiert. Als Nächstes: ${next.title}.`;
  return { percent, text };
}

export async function getTask(id: string): Promise<Task | undefined> {
  return (await getTasks()).find(task => task.id === id);
}
