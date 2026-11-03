'use client';

import { useEffect, useRef } from 'react';
import styles from './OnboardingDialog.module.css';

type OnboardingDialogProps = {
  open: boolean;
  onConfirm: () => void;
};

// Sicherheitshinweis beim ersten Besuch (Figma „Gastansicht“) – schließt nur über „Verstanden“
export function OnboardingDialog({ open, onConfirm }: OnboardingDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="onboarding-title"
      // Escape soll den Hinweis nicht wegklicken – er muss bestätigt werden
      onCancel={(event) => event.preventDefault()}
    >
      <h2 id="onboarding-title" className={styles.title}>
        Wichtig für deine Sicherheit
      </h2>
      <p className={styles.text}>
        Alle Nährwerte sind Schätzungen auf Basis von Standardportionen und können von der tatsächlichen
        Portion abweichen.
      </p>
      <p className={styles.text}>
        Nutze sie als Orientierung und passe deine Insulindosierung wie gewohnt an, makroklar. ersetzt keine
        ärztliche Beratung.
      </p>
      <button type="button" className={styles.button} onClick={onConfirm} autoFocus>
        Verstanden
      </button>
    </dialog>
  );
}
