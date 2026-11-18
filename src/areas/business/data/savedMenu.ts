import { cache } from 'react';
import { createClient } from '@/shared/supabase/server';
import { fromStoredDish } from './menuStorageModel';
import type { MenuSnapshot } from '../types/menuStorage';
import type { ImportedMenuItem } from '../types/importedMenuItem';

const unavailable = 'Deine gespeicherten Artikel konnten nicht geladen werden. Bitte lade die Seite erneut.';

export async function getMenuSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    const anonymous = !error || error.name === 'AuthSessionMissingError' || error.status === 401
      || error.status === 403 || error.code === 'bad_jwt';
    return { supabase, accountKey: anonymous ? 'anonymous' : 'unavailable', restaurantId: null,
      error: anonymous ? null : 'Dein Anmeldestatus konnte gerade nicht geprüft werden.' };
  }
  const accountKey = data.user.id;
  const members = await supabase.from('restaurant_members').select('restaurant_id')
    .eq('user_id', data.user.id).eq('role', 'owner').limit(2);
  if (members.error) return { supabase, accountKey, restaurantId: null, error: unavailable };
  if (members.data.length !== 1) {
    return { supabase, accountKey, restaurantId: null, error: members.data.length === 0
      ? 'Bitte schließe zuerst die Einrichtung deines Restaurants über dein Benutzerkonto ab.'
      : 'Dein Restaurant konnte nicht eindeutig zugeordnet werden. Eine Restaurantauswahl ist erforderlich.' };
  }
  return { supabase, accountKey, restaurantId: members.data[0].restaurant_id, error: null };
}

export const readSavedMenu = cache(async (): Promise<MenuSnapshot> => {
  let accountKey = 'unavailable';
  let restaurantId: string | null = null;
  try {
    const session = await getMenuSession();
    accountKey = session.accountKey;
    restaurantId = session.restaurantId;
    if (!restaurantId || session.error) return { accountKey, restaurantId, items: [], error: session.error };

    const items: ImportedMenuItem[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const result = await session.supabase.from('dishes').select(
        'id,restaurant_id,name,source,source_id,dish_import_details(dish_id,restaurant_id,sku,accounting_group_source_id,accounting_group_name,prices,selected_price_index,currency)',
      ).eq('restaurant_id', restaurantId).eq('source', 'lightspeed-k-series')
        .order('created_at').order('id').range(offset, offset + pageSize - 1);
      if (result.error) return { accountKey, restaurantId, items: [], error: unavailable };
      items.push(...result.data.map(row => fromStoredDish(row, restaurantId!)));
      if (result.data.length < pageSize) break;
    }
    if (new Set(items.map(item => item.sourceId)).size !== items.length) throw new Error('Duplicate stored identities.');
    return { accountKey, restaurantId, items, error: null };
  } catch {
    return { accountKey, restaurantId, items: [], error: unavailable };
  }
});
