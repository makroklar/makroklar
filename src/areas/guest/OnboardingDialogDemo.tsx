'use client';

import { useState } from 'react';
import { OnboardingDialog } from './components/onboarding/OnboardingDialog';
import styles from './ComponentsPage.module.css';

// Öffnet den Dialog auf der Komponentenseite per Knopfdruck
export function OnboardingDialogDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.demoButton} onClick={() => setOpen(true)}>
        Dialog öffnen
      </button>
      <OnboardingDialog open={open} onConfirm={() => setOpen(false)} />
    </>
  );
}
