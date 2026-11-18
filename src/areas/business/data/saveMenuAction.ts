'use server';

import { revalidatePath } from 'next/cache';
import { acceptedMenuItemsSchema, toImportPayload } from './menuStorageModel';
import { getMenuSession } from './savedMenu';
import type { SaveMenuResult } from '../types/menuStorage';

export async function saveMenuItems(value: unknown): Promise<SaveMenuResult> {
  const parsed = acceptedMenuItemsSchema.safeParse(value);
  if (!parsed.success) return { status: 'error', message: 'Bitte prüfe Namen, Preise und Auswahl der Artikel.' };

  try {
    const session = await getMenuSession();
    if (session.error || !session.restaurantId) return {
      status: 'error', message: session.error ?? 'Bitte melde dich erneut an, bevor du Artikel speicherst.',
    };
    const result = await session.supabase.rpc('import_lightspeed_items', {
      target_restaurant_id: session.restaurantId,
      imported_items: toImportPayload(parsed.data),
    });
    if (result.error || result.data !== parsed.data.length) return {
      status: 'error', message: 'Die Speicherung konnte nicht bestätigt werden. Bitte versuche es erneut.',
    };
  } catch {
    return { status: 'error', message: 'Die Speicherung konnte nicht bestätigt werden. Bitte versuche es erneut.' };
  }
  // The RPC is committed. A cache-invalidation failure must not be reported as an unsaved batch.
  try { revalidatePath('/business', 'layout'); } catch { /* A full reload still reads the database. */ }
  return { status: 'saved', items: parsed.data };
}
