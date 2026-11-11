import type { ReactNode } from 'react';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import { BusinessDraftProvider } from './state/BusinessDraftContext';
import styles from './BusinessLayout.module.css';
import { readSavedMenu } from './data/savedMenu';
import { readOnboarding } from './data/readOnboarding';

// Layout der Restaurantansicht (Figma-Datei 1) – Navigation usw. kommt später
export async function BusinessLayout({ children }: { children: ReactNode }) {
  const [snapshot, onboarding] = await Promise.all([readSavedMenu(), readOnboarding()]);
  return (
    <BusinessDraftProvider key={`${snapshot.accountKey}:${snapshot.restaurantId ?? 'none'}`} snapshot={snapshot} onboarding={onboarding}>
      <div className={styles.layout}>
        {children}
      </div>
    </BusinessDraftProvider>
  );
}
