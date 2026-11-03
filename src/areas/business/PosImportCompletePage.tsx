'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import checkCircle from './assets/check-circle.svg';
import { ArrowIcon } from './components/ui/ArrowIcon';
import { useBusinessDraft } from './state/BusinessDraftContext';
import styles from './PosImportCompletePage.module.css';

export function PosImportCompletePage() {
  const { importedItems } = useBusinessDraft();
  const router = useRouter();
  const hasImportedItems = importedItems.length > 0;

  useEffect(() => {
    if (!hasImportedItems) {
      router.replace('/business/onboarding/menu/pos');
    }
  }, [hasImportedItems, router]);

  if (!hasImportedItems) {
    return (
      <section
        className={styles.result}
        data-onboarding-card="compact"
        aria-busy="true"
      >
        <span className={styles.visuallyHidden}>Zur Artikelauswahl…</span>
      </section>
    );
  }

  return (
    <section
      className={styles.result}
      data-onboarding-card="compact"
      aria-labelledby="pos-complete-title"
    >
      <header className={styles.intro}>
        <h1 className={styles.title} id="pos-complete-title">
          Kassensystem erfolgreich verknüpft!
        </h1>
        <p className={styles.description}>
          Dein Kassensystem wurde sicher verbunden. makroklar. importiert jetzt im
          Hintergrund automatisch deine Speisekarte und die Preise. Du kannst
          derweil ganz in Ruhe mit dem nächsten Schritt weitermachen.
        </p>
      </header>
      <Image className={styles.check} src={checkCircle} alt="" />
      <Link
        className={styles.continueButton}
        href="/business/onboarding/purchases"
      >
        <span>Weiter</span>
        <ArrowIcon tone="accent" />
      </Link>
    </section>
  );
}
