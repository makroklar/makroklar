'use client';

import { useState } from 'react';
import { InjectionHintDialog } from './components/dish-detail/InjectionHintDialog';
import styles from './ComponentsPage.module.css';

// Öffnet den Hinweis fürs Spritzen auf der Komponentenseite per Knopfdruck
export function InjectionHintDialogDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.demoButton} onClick={() => setOpen(true)}>
        Dialog öffnen
      </button>
      <InjectionHintDialog open={open} fpe={4.4} hours="6-8" onConfirm={() => setOpen(false)} />
    </>
  );
}
