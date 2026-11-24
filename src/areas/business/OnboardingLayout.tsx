import type { ReactNode } from 'react';
import { OnboardingHeader } from './components/onboarding/OnboardingHeader';
import { MenuImportSkip } from './components/onboarding/MenuImportSkip';
import styles from './OnboardingLayout.module.css';

export function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.cardGroup}>
        <section className={styles.card} aria-label="Restaurant einrichten">
          <OnboardingHeader />
          <div className={styles.content}>{children}</div>
        </section>
        <MenuImportSkip />
      </div>
    </main>
  );
}
