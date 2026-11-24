import { cache } from 'react';
import { getMenuSession } from './savedMenu';
import { onboardingSnapshotSchema, type OnboardingSnapshot } from './onboardingModel';
import { basisOnboardingSnapshotSchema, type BasisOnboardingSnapshot } from './basisOnboardingModel';

// Legacy data can still be displayed before deployment, but cannot be saved via v1.
export interface OnboardingRead { snapshot: OnboardingSnapshot | BasisOnboardingSnapshot | null; error: string | null; }

export const readOnboarding = cache(async (): Promise<OnboardingRead> => {
  try {
    const session = await getMenuSession();
    if (!session.restaurantId) return { snapshot: null, error: session.error };
    const result = await session.supabase.rpc('read_restaurant_onboarding_v2', { target_restaurant_id: session.restaurantId });
    if (result.error?.code === 'PGRST202') {
      const legacy = await session.supabase.rpc('read_restaurant_onboarding', { target_restaurant_id: session.restaurantId });
      return { snapshot: legacy.error ? null : onboardingSnapshotSchema.parse(legacy.data),
        error: 'Die erweiterte Rezept-Speicherung ist noch nicht eingerichtet. Deine Änderungen sind vorläufig; die Einrichtung kann noch nicht abgeschlossen werden.' };
    }
    if (result.error) return { snapshot: null,
      error: 'Die gespeicherten Rezepte konnten nicht geladen werden. Bitte versuche es erneut, bevor du abschließt.' };
    return { snapshot: basisOnboardingSnapshotSchema.parse(result.data), error: null };
  } catch { return { snapshot: null, error: 'Die gespeicherten Rezepte konnten nicht geladen werden. Bitte versuche es erneut.' }; }
});
