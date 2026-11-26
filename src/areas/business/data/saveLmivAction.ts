'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getMenuSession } from './savedMenu';
import { getRecipe } from './restaurantData';
import { ADDITIVES, ALLERGENS } from './dashboardModel';

// LMIV-Freigabe: Allergene/Zusatzstoffe speichern und Gerichte veröffentlichen.
// Die Regeln (veröffentlichen nur mit bestätigten Allergenen und vollständigen Nährwerten)
// prüft die Datenbank in save_dish_allergens / set_dish_published.

export type LmivResult = { status: 'saved' } | { status: 'error'; message: string };

const allergenCodes = ALLERGENS.map(entry => entry.code) as [string, ...string[]];
const additiveCodes = ADDITIVES.map(entry => entry.code) as [string, ...string[]];

const lmivInput = z.object({
  key: z.string().min(1),
  allergens: z.array(z.enum(allergenCodes)).max(ALLERGENS.length),
  additives: z.array(z.enum(additiveCodes)).max(ADDITIVES.length),
  /** true = Angaben bestätigen und veröffentlichen; false = nur als Entwurf speichern */
  publish: z.boolean(),
});

function message(error: { code?: string; message?: string }): string {
  if (error.code === '42501') return 'Du hast keinen Zugriff auf dieses Gericht. Bitte melde dich erneut an.';
  if (error.message?.includes('Nutrition must be complete')) return 'Die Nährwerte sind noch unvollständig. Bitte ergänze zuerst Zutaten und Mengen.';
  if (error.message?.includes('Allergens must be confirmed')) return 'Bitte bestätige zuerst die Allergen- und Zusatzstoffangaben.';
  return 'Das Speichern konnte nicht bestätigt werden. Bitte versuche es erneut.';
}

export async function saveLmiv(input: unknown): Promise<LmivResult> {
  const parsed = lmivInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Bitte prüfe die ausgewählten Allergene und Zusatzstoffe.' };
  const { key, allergens, additives, publish } = parsed.data;
  try {
    const [session, recipe] = await Promise.all([getMenuSession(), getRecipe(key)]);
    if (!session.restaurantId || session.error) return { status: 'error', message: session.error ?? 'Bitte melde dich erneut an.' };
    if (!recipe?.dishId) return { status: 'error', message: 'Dieses Gericht wurde nicht gefunden. Bitte lade die Seite neu.' };

    // Ohne Bestätigung hebt die Datenbank eine frühere Bestätigung und Veröffentlichung auf.
    const saved = await session.supabase.rpc('save_dish_allergens', {
      target_dish_id: recipe.dishId, allergen_codes: allergens, additive_codes: additives, confirm: publish,
    });
    if (saved.error) return { status: 'error', message: message(saved.error) };
    if (publish) {
      const published = await session.supabase.rpc('set_dish_published', { target_dish_id: recipe.dishId, published: true });
      if (published.error) return { status: 'error', message: message(published.error) };
    }
    try { revalidatePath('/business', 'layout'); } catch { /* gespeichert ist gespeichert */ }
    return { status: 'saved' };
  } catch {
    return { status: 'error', message: 'Das Speichern konnte nicht bestätigt werden. Bitte versuche es erneut.' };
  }
}

/** Gericht von der Speisekarte nehmen; Allergenangaben bleiben bestätigt. */
export async function unpublishDish(key: unknown): Promise<LmivResult> {
  if (typeof key !== 'string' || key === '') return { status: 'error', message: 'Dieses Gericht wurde nicht gefunden.' };
  try {
    const [session, recipe] = await Promise.all([getMenuSession(), getRecipe(key)]);
    if (!session.restaurantId || session.error) return { status: 'error', message: session.error ?? 'Bitte melde dich erneut an.' };
    if (!recipe?.dishId) return { status: 'error', message: 'Dieses Gericht wurde nicht gefunden. Bitte lade die Seite neu.' };
    const result = await session.supabase.rpc('set_dish_published', { target_dish_id: recipe.dishId, published: false });
    if (result.error) return { status: 'error', message: message(result.error) };
    try { revalidatePath('/business', 'layout'); } catch { /* gespeichert ist gespeichert */ }
    return { status: 'saved' };
  } catch {
    return { status: 'error', message: 'Das Speichern konnte nicht bestätigt werden. Bitte versuche es erneut.' };
  }
}
