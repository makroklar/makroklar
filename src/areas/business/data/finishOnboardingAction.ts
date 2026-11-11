'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getMenuSession } from './savedMenu';
import { onboardingPayloadSchema, completionSummarySchema, type CompletionSummary } from './onboardingModel';
import { getOffProduct } from './offProducts';

export type FinishResult = { status: 'saved'; summary: CompletionSummary }
  | { status: 'error'; message: string };

export async function finishOnboarding(input: unknown): Promise<FinishResult> {
  const parsed = z.object({ payload: onboardingPayloadSchema, version: z.number().int().nonnegative(), requestId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Gerichte, Zutaten und Mengen.' };
  try {
    const session = await getMenuSession();
    if (!session.restaurantId || session.error) return { status: 'error', message: session.error ?? 'Bitte melde dich erneut an.' };
    const payload = parsed.data.payload;
    // Never promote client-edited OFF values into the persistent cache.
    for (let index = 0; index < payload.catalogFoods.length; index++) {
      const food = payload.catalogFoods[index];
      if (food.source.kind !== 'off') continue;
      const verified = await getOffProduct(food.source.barcode, session.supabase, { forSave: true });
      if (verified.status === 'error') return verified;
      if (verified.foods.length !== 1) return { status: 'error', message: `${food.name} konnte nicht mehr gefunden werden. Bitte prüfe dieses Lebensmittel.` };
      payload.catalogFoods[index] = verified.foods[0];
    }
    // Recheck units after authoritative OFF data is restored, then normalize decimals for SQL.
    const checked = onboardingPayloadSchema.safeParse(payload);
    if (!checked.success) return { status: 'error', message: checked.error.issues[0]?.message ?? 'Bitte prüfe die aktuellen Nährwertangaben.' };
    for (const recipe of Object.values(payload.recipes)) {
      // Onboarding quantities describe one plated portion; the database still supports batch recipes.
      recipe.servings = '1';
      for (const line of recipe.ingredients) line.quantity = line.quantity.trim().replace(',', '.');
    }
    const result = await session.supabase.rpc('save_restaurant_onboarding', {
      target_restaurant_id: session.restaurantId, payload, base_version: parsed.data.version, request_id: parsed.data.requestId,
    });
    if (result.error) return { status: 'error', message: result.error.code === '40001'
      ? 'Die Einrichtung wurde in einer anderen Sitzung geändert. Bitte sichere deine Eingaben und lade die aktuellen Daten neu.'
      : result.error.code === 'PGRST202' ? 'Die Rezept-Speicherung ist noch nicht eingerichtet. Deine Eingaben bleiben vorläufig.'
      : 'Das Speichern konnte nicht bestätigt werden. Deine Eingaben bleiben erhalten; bitte versuche es erneut.' };
    const summary = completionSummarySchema.parse(result.data);
    try { revalidatePath('/business', 'layout'); } catch { /* A confirmed commit remains saved. */ }
    return { status: 'saved', summary };
  } catch { return { status: 'error', message: 'Das Speichern konnte nicht bestätigt werden. Bitte versuche es erneut.' }; }
}
