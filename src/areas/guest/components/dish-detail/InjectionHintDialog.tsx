'use client';

import { useEffect, useRef } from 'react';
import styles from './InjectionHintDialog.module.css';

type InjectionHintDialogProps = {
  open: boolean;
  /** Fett-Protein-Einheiten des Gerichts */
  fpe: number;
  /** Zeitraum, in dem der BZ noch ansteigen kann, z. B. „6-8“ */
  hours: string;
  onConfirm: () => void;
};

const fpeFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

// Hinweis fürs Spritzen bei Fett & Protein (Figma „Gastansicht“, Frame 300:803) – schließt nur über „Verstanden“
export function InjectionHintDialog({ open, fpe, hours, onConfirm }: InjectionHintDialogProps) {
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
      aria-labelledby="injection-hint-title"
      // Escape soll den Hinweis nicht wegklicken – er muss bestätigt werden
      onCancel={(event) => event.preventDefault()}
    >
      <h2 id="injection-hint-title" className={styles.title}>
        Hinweis fürs Spritzen
      </h2>
      <p className={styles.text}>Achtung, Fett &amp; Protein!</p>
      <p className={styles.text}>
        {/* Werte fett und mit Einheit in einer Zeile, auch „6-8“ wird nicht am Bindestrich getrennt */}
        Dieser Wert enthält <strong className={styles.value}>{fpeFormat.format(fpe)} FPE</strong> und kann deinen{' '}
        <strong className={styles.value}>BZ</strong> noch ca.&nbsp;<strong className={styles.value}>{hours} Stunden</strong>{' '}
        nach dem Essen ansteigen lassen.
      </p>
      <p className={styles.text}>Überlege, deine Insulindosis aufzuteilen.</p>
      <p className={`${styles.text} ${styles.spaced}`}>
        Bitte gleiche die Portion visuell mit dem Referenzfoto ab, bevor du spritzt.
      </p>
      <button type="button" className={styles.button} onClick={onConfirm} autoFocus>
        Verstanden
      </button>
    </dialog>
  );
}
