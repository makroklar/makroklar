'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getMenuSession } from './savedMenu';
import { completionSummarySchema, type CompletionSummary } from './onboardingModel';
import { basisOnboardingPayloadSchema, normalizeBasisPayload } from './basisOnboardingModel';
import { getOffProduct } from './offProducts';
import { publishOffCache } from './offCache';
import type { CatalogFood } from '../types/catalogFood';

export type FinishResult = { status: 'saved'; summary: CompletionSummary }
  | { status: 'error'; message: string };

export async function finishOnboarding(input: unknown): Promise<FinishResult> {
  const parsed = z.object({ payload: basisOnboardingPayloadSchema, version: z.number().int().nonnegative(), requestId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Gerichte, Zutaten und Mengen.' };
  try {
    const session = await getMenuSession();
    if (!session.restaurantId || session.error) return { status: 'error', message: session.error ?? 'Bitte melde dich erneut an.' };
    const payload = parsed.data.payload;
    const cacheCandidates: CatalogFood[] = [];
    // Never promote client-edited OFF values into the persistent cache.
    for (let index = 0; index < payload.catalogFoods.length; index++) {
      const food = payload.catalogFoods[index];
      if (food.source.kind !== 'off') continue;
      const verified = await getOffProduct(food.source.barcode, session.supabase, { forSave: true });
      if (verified.status === 'error') return verified;
      if (verified.foods.length !== 1) return { status: 'error', message: `${food.name} konnte nicht mehr gefunden werden. Bitte prüfe dieses Lebensmittel.` };
      payload.catalogFoods[index] = verified.foods[0];
      if (verified.cacheCandidate) cacheCandidates.push(verified.cacheCandidate);
    }
    // Recheck units after authoritative OFF data is restored, then normalize decimals for SQL.
    const checked = basisOnboardingPayloadSchema.safeParse(payload);
    if (!checked.success) return { status: 'error', message: checked.error.issues[0]?.message ?? 'Bitte prüfe die aktuellen Nährwertangaben.' };
    const result = await session.supabase.rpc('save_restaurant_onboarding_v2', {
      target_restaurant_id: session.restaurantId, payload: normalizeBasisPayload(checked.data),
      base_version: parsed.data.version, request_id: parsed.data.requestId,
    });
    if (result.error) return { status: 'error', message: result.error.code === '40001'
      ? 'Die Einrichtung wurde in einer anderen Sitzung geändert. Bitte sichere deine Eingaben und lade die aktuellen Daten neu.'
      : result.error.code === 'PGRST202' ? 'Die erweiterte Rezept-Speicherung ist noch nicht eingerichtet. Deine Eingaben bleiben vorläufig.'
      : 'Das Speichern konnte nicht bestätigt werden. Deine Eingaben bleiben erhalten; bitte versuche es erneut.' };
    const summary = completionSummarySchema.parse(result.data);
    // Publication follows a confirmed save; failure must not report that save as failed.
    try { await publishOffCache(session.restaurantId, parsed.data.requestId, cacheCandidates); }
    catch { console.warn('[OFF cache] Publication unavailable; restaurant data remains saved.'); }
    try { revalidatePath('/business', 'layout'); } catch { /* A confirmed commit remains saved. */ }
    return { status: 'saved', summary };
  } catch { return { status: 'error', message: 'Das Speichern konnte nicht bestätigt werden. Bitte versuche es erneut.' }; }
}
