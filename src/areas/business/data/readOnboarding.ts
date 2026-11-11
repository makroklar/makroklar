import { cache } from 'react';
import { getMenuSession } from './savedMenu';
import { onboardingSnapshotSchema, type OnboardingSnapshot } from './onboardingModel';

export interface OnboardingRead { snapshot: OnboardingSnapshot | null; error: string | null; }

export const readOnboarding = cache(async (): Promise<OnboardingRead> => {
  try {
    const session = await getMenuSession();
    if (!session.restaurantId) return { snapshot: null, error: session.error };
    const result = await session.supabase.rpc('read_restaurant_onboarding', { target_restaurant_id: session.restaurantId });
    if (result.error) return { snapshot: null, error: result.error.code === 'PGRST202'
      ? 'Die Speicherung der Rezepte ist noch nicht eingerichtet. Deine neuen Änderungen sind vorläufig.'
      : 'Die gespeicherten Rezepte konnten nicht geladen werden. Bitte versuche es erneut, bevor du abschließt.' };
    return { snapshot: onboardingSnapshotSchema.parse(result.data), error: null };
  } catch { return { snapshot: null, error: 'Die gespeicherten Rezepte konnten nicht geladen werden. Bitte versuche es erneut.' }; }
});
