import { cache } from 'react';
import { getMenuSession } from './savedMenu';
import { onboardingSnapshotSchema, type OnboardingSnapshot } from './onboardingModel';
import type { BasisOnboardingSnapshot } from './basisOnboardingModel';

// Provider accepts v2 snapshots; switching the RPC/validator waits for deployment.
export interface OnboardingRead { snapshot: OnboardingSnapshot | BasisOnboardingSnapshot | null; error: string | null; }

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
