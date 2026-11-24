'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { NewDishForm } from './components/onboarding/NewDishForm';
import { ArrowIcon } from './components/ui/ArrowIcon';
import { useBusinessDraft } from './state/BusinessDraftContext';
import styles from './ManualMenuPage.module.css';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function ManualMenuPage() {
  const { customDishes, onboardingError } = useBusinessDraft();
  const [adding, setAdding] = useState(true);
  const [refreshing, startRefresh] = useTransition();
  const addButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  function closeForm() {
    setAdding(false);
    // Restore focus after the shared form unmounts on add or cancel.
    requestAnimationFrame(() => addButton.current?.focus());
  }

  return (
    <section className={styles.page} aria-labelledby="manual-menu-title">
      <header className={styles.intro}>
        <h1 id="manual-menu-title">Erstelle deine Speisekarte.</h1>
        <p>Trage deine Gerichte und optional ihre Preise ein. Zutaten und Mengen ordnest du im letzten Schritt zu.</p>
      </header>
      <p className={styles.note}>Bilder kannst du später im Dashboard hinzufügen.</p>

      {onboardingError ? (
        <div className={styles.message}>
          <p className={styles.error} role="alert">{onboardingError}</p>
          <button className={styles.textButton} type="button" disabled={refreshing}
            onClick={() => startRefresh(() => router.refresh())}>
            {refreshing ? 'Wird geladen …' : 'Erneut laden'}
          </button>
        </div>
      ) : (
        <>
          {adding ? <NewDishForm onClose={closeForm} /> : (
            <button ref={addButton} className={styles.addButton} type="button" onClick={() => setAdding(true)}>
              Weiteres Gericht hinzufügen
            </button>
          )}
          <h2 className={styles.listTitle} aria-live="polite" aria-atomic="true">
            Manuell erstellte Gerichte ({customDishes.length})
          </h2>
          {customDishes.length === 0 ? (
            <p className={styles.empty}>Noch keine Gerichte hinzugefügt. Beginne mit dem Namen deines ersten Gerichts.</p>
          ) : (
            <ul className={styles.list} aria-label="Manuell erstellte Gerichte">
              {customDishes.map(dish => (
                <li className={styles.dish} key={dish.id}>
                  <span className={styles.dishName}>{dish.name}</span>
                  <span className={styles.price}>{dish.price === null ? 'Preis offen' : euro.format(dish.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className={styles.note}>
        Neue Gerichte werden am Ende der Einrichtung gespeichert. Bis dahin bleiben sie beim Wechsel zwischen den Schritten erhalten, gehen aber beim Neuladen der Seite verloren.
      </p>
      <div className={styles.actions}>
        <Link className={styles.continueButton} href="/business/onboarding/purchases">
          <span>Weiter</span><ArrowIcon tone="inherit" />
        </Link>
      </div>
    </section>
  );
}
