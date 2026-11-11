'use client';

import { useRef, useState, type FormEvent } from 'react';
import { newDishSchema } from '../../data/recipeDraft';
import { useBusinessDraft } from '../../state/BusinessDraftContext';
import styles from './NewDishForm.module.css';

export function NewDishForm({ onClose }: { onClose: () => void }) {
  const { addCustomDish } = useBusinessDraft();
  const [error, setError] = useState('');
  const submitted = useRef(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    const form = new FormData(event.currentTarget);
    const parsed = newDishSchema.safeParse({ name: form.get('name'), price: form.get('price') });
    if (!parsed.success) { setError('Bitte einen Namen und gegebenenfalls einen Preis ab 0 mit maximal zwei Nachkommastellen eingeben.'); return; }
    submitted.current = true;
    addCustomDish({ id: crypto.randomUUID(), ...parsed.data });
    onClose();
  }
  return (
    <form className={styles.form} onSubmit={submit} aria-labelledby="new-dish-title">
      <h2 id="new-dish-title">Neues Gericht</h2>
      <label htmlFor="new-dish-name">Name des Gerichts
        <input id="new-dish-name" name="name" required maxLength={200} autoFocus />
      </label>
      <label htmlFor="new-dish-price">Verkaufspreis in € (optional)
        <input id="new-dish-price" name="price" inputMode="decimal" placeholder="z. B. 12,50" maxLength={10} />
      </label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onClose}>Abbrechen</button>
        <button type="submit" className={styles.submit}>Gericht hinzufügen</button>
      </div>
    </form>
  );
}
