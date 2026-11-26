// Datenmodell der Dashboard-Seiten: Typen, feste Texte und Listen. Keine Daten.
// Die Daten selbst liest restaurantData.ts aus Supabase und bildet sie auf diese Typen ab.

import type { CatalogFood } from '../types/catalogFood';

export type TaskId = 'import-pruefen' | 'basis-abwiegen' | 'gerichte-einrichten' | 'lmiv-freigabe';
export type RecipeKind = 'dish' | 'basis';

export interface Ingredient {
  /** Zeilen-ID in der Oberfläche */
  id: string;
  name: string;
  supplier: string;
  quantity: number | null;
  unit: 'g' | 'ml';
  /** ID des Lebensmittels im Onboarding-Stand (catalogFoods / manualFoods) */
  foodId: string;
  /** Nährwertbasis; legt die Einheit fest, wenn bekannt */
  basis?: '100g' | '100ml' | null;
  /** Neu gesuchtes Lebensmittel, das beim Speichern mitgespeichert wird */
  catalogFood?: CatalogFood;
}

export interface Nutrition {
  energyKcal: number;
  fatG: number;
  carbohydrateG: number;
  proteinG: number;
  /** Fett-Protein-Einheiten, relevant für Diabetiker */
  fpe: number;
}

export interface Recipe {
  slug: string;
  name: string;
  kind: RecipeKind;
  category: string;
  source: string;
  ingredients: Ingredient[];
  /** Zubereitung aus dem erkannten Dokument (Import prüfen) */
  preparation?: string;
  /** Nur Basen: wie viele Gerichte die Basis verwenden */
  usedInDishes?: number;
  cookedWeight: number | null;
  /** Nur Gerichte */
  portion?: { size: number; unit: string };
  price?: number;
  /** Preis kommt aus dem Kassensystem und wird hier nicht geändert */
  priceFromPos?: boolean;
  prepMinutes?: number;
  description?: string;
  /** Berechnete Nährwerte pro Portion (nur wenn vollständig) */
  nutrition?: Nutrition;
  onMenu: boolean;
  /** Nur Gerichte: Zeile in der Tabelle dishes (für Freigabe und Veröffentlichung) */
  dishId?: string;
  /** Codes aus ALLERGENS / ADDITIVES, wie in der Datenbank gespeichert */
  allergens?: string[];
  additives?: string[];
  /** Allergene und Zusatzstoffe vom Restaurant bestätigt (LMIV) */
  allergensConfirmed?: boolean;
  /** Für Gäste veröffentlicht */
  published?: boolean;
  /** Was im Datenstand noch fehlt; leer = vollständig */
  missing: string | null;
}

export interface Task {
  id: TaskId;
  title: string;
  subtitle: string;
  /** Text in der To-do-Liste des Dashboards */
  summary: (open: number) => string;
  itemHint: string;
  infoTitle: string;
  infoText: string;
  nextAction: (name: string) => string;
  total: number;
  open: number;
  /** Offene Einträge (Rezept-Slugs), in der Reihenfolge der Bearbeitung */
  items: string[];
  /** Text, solange es für die Aufgabe noch keine Einträge gibt */
  emptyText: string;
  /** Erledigte Einträge (nicht immer total − open, z. B. bei der LMIV-Freigabe) */
  done: number;
  /** false, solange die Datenbank für diese Aufgabe noch keine Daten liefern kann */
  available: boolean;
}

export type TaskTemplate = Omit<Task, 'total' | 'open' | 'items' | 'done' | 'available'>;

export interface Progress {
  /** 0–100 */
  percent: number;
  text: string;
}

export const TASK_TEMPLATES: Record<TaskId, TaskTemplate> = {
  'import-pruefen': {
    id: 'import-pruefen', title: 'Import prüfen', subtitle: 'Erkannte Rezepte, Zutaten und Mengen abgleichen.',
    summary: open => `${open} erkannte Rezepte und Zutaten abgleichen`, itemHint: 'Scan prüfen',
    infoTitle: 'Warum prüfen?', infoText: 'KI-Erkennungen bleiben Vorschläge. Unsichere Zutaten und Mengen werden deshalb sichtbar markiert.',
    nextAction: name => `${name} öffnen`,
    emptyText: 'Noch keine importierten Rezepte zum Prüfen.',
  },
  'basis-abwiegen': {
    id: 'basis-abwiegen', title: 'Basis abwiegen', subtitle: 'Rohes und gekochtes Gewicht deiner Komponenten erfassen.',
    summary: open => `Rohes und gekochtes Gewicht für ${open} Basis-Komponenten eintragen.`, itemHint: 'Gewichte prüfen und einmal Gesamtgewicht wiegen',
    infoTitle: 'Warum zwei Gewichte?', infoText: 'Beim Kochen verändert sich das Gewicht durch Wasserverlust. Beide Werte sind für die spätere Berechnung relevant.',
    nextAction: name => `${name} abwiegen`,
    emptyText: 'Noch keine Basen angelegt.',
  },
  'gerichte-einrichten': {
    id: 'gerichte-einrichten', title: 'Gerichte einrichten', subtitle: 'Zutaten und Mengen ergänzen, damit die Nährwerte berechnet werden.',
    summary: open => `Zutaten und Mengen für ${open} Gerichte eintragen`, itemHint: 'Zutaten und Mengen pro Portion eintragen.',
    infoTitle: 'Wofür werden die Werte gebraucht?', infoText: 'Aus den Zutaten und Mengen pro Portion berechnet makroklar die Nährwerte, die deine Gäste später sehen.',
    nextAction: name => `${name} öffnen`,
    emptyText: 'Noch keine Gerichte importiert.',
  },
  'lmiv-freigabe': {
    id: 'lmiv-freigabe', title: 'LMIV-Freigabe', subtitle: 'Allergene prüfen und Gerichte für Gäste veröffentlichen.',
    summary: open => `Allergene für ${open} Gerichte prüfen und für Gäste freischalten`, itemHint: 'Allergene und Nährwerte prüfen.',
    infoTitle: 'Vor der Veröffentlichung', infoText: 'Allergene und Zusatzstoffe müssen einmal bestätigt werden. Die Nährwerte sind bereits berechnet.',
    nextAction: name => `${name} prüfen`,
    emptyText: 'Noch kein Gericht mit vollständigen Nährwerten.',
  },
};

/** Die 14 Hauptallergene nach LMIV, Anhang II. code = Wert in dishes.allergens */
export const ALLERGENS = [
  { code: 'gluten', label: 'Glutenhaltiges Getreide' }, { code: 'nuts', label: 'Schalenfrüchte (Nüsse)' },
  { code: 'crustaceans', label: 'Krebstiere' }, { code: 'celery', label: 'Sellerie' },
  { code: 'eggs', label: 'Eier' }, { code: 'mustard', label: 'Senf' },
  { code: 'fish', label: 'Fisch' }, { code: 'sesame', label: 'Sesam' },
  { code: 'peanuts', label: 'Erdnüsse' }, { code: 'sulphites', label: 'Schwefeldioxid/Sulfite' },
  { code: 'soy', label: 'Soja' }, { code: 'lupin', label: 'Lupinen' },
  { code: 'milk', label: 'Milch / Laktose' }, { code: 'molluscs', label: 'Weichtiere' },
] as const;
/** Kennzeichnungspflichtige Zusatzstoffe. code = Wert in dishes.additives */
export const ADDITIVES = [
  { code: 'colourings', label: 'Farbstoffe' }, { code: 'flavour_enhancers', label: 'Geschmacksverstärker' },
  { code: 'preservatives', label: 'Konservierungsstoffe' }, { code: 'sweeteners', label: 'Süßungsmittel' },
  { code: 'antioxidants', label: 'Antioxidationsmittel' }, { code: 'phosphate', label: 'Phosphat' },
] as const;

export const BASIS_CATEGORIES = ['Sauce', 'Teig', 'Dressing', 'Creme', 'Sonstiges'];

// Kategorien der Gastansicht, plus Salate
export const DISH_CATEGORIES = ['Vorspeise', 'Salate', 'Hauptspeise', 'Dessert', 'Getränke'];

// Startwert aus der Warengruppe der Kasse ableiten, z. B. „Hauptgerichte“ → „Hauptspeise“. Ohne Treffer: leer.
const DISH_CATEGORY_HINTS: [RegExp, string][] = [
  [/salat|salad/i, 'Salate'],
  [/vorspeise|starter|antipast|tapas|suppe/i, 'Vorspeise'],
  [/dessert|nachspeise|nachtisch|eis\b|kuchen/i, 'Dessert'],
  [/getränk|drink|bier|wein|saft|kaffee|tee\b|softdrink|cocktail/i, 'Getränke'],
  [/haupt|pizza|pasta|nudel|burger|fleisch|fisch|curry|bowl|grill/i, 'Hauptspeise'],
];

export function guessDishCategory(group: string): string {
  if (DISH_CATEGORIES.includes(group)) return group;
  return DISH_CATEGORY_HINTS.find(([pattern]) => pattern.test(group))?.[1] ?? '';
}

export const FALLBACK_RESTAURANT_NAME = 'Dein Restaurant';

/** Aufgaben-Detailseite eines Rezepts, z. B. für „Bearbeiten“ in Bibliothek und Speisekarte */
export function editHref(recipe: Recipe): string {
  return recipe.kind === 'basis'
    ? `/business/aufgaben/basis-abwiegen/${recipe.slug}`
    : `/business/aufgaben/gerichte-einrichten/${recipe.slug}`;
}
