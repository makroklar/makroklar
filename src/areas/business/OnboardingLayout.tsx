import type { ReactNode } from 'react';
import { OnboardingHeader } from './components/onboarding/OnboardingHeader';
import styles from './OnboardingLayout.module.css';

export function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-label="Restaurant einrichten">
        <OnboardingHeader />
        <div className={styles.content}>{children}</div>
      </section>
    </main>
  );
}
