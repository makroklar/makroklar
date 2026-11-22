'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { manualFoodNoticeVersion, validateManualFood, type ManualFoodErrors } from '../../data/manualFood';
import { useBusinessDraft } from '../../state/BusinessDraftContext';
import styles from './ManualFoodEntry.module.css';

const nutrients = [
  { key: 'energyKcal', label: 'Energie', unit: 'kcal' },
  { key: 'proteinG', label: 'Eiweiß', unit: 'g' },
  { key: 'fatG', label: 'Fett', unit: 'g' },
  { key: 'carbohydrateG', label: 'Kohlenhydrate', unit: 'g' },
] as const;

export function ManualFoodEntry() {
  const { addManualFood } = useBusinessDraft();
  const router = useRouter();
  const errorSummary = useRef<HTMLParagraphElement>(null);
  const submitted = useRef(false);
  const [agreed, setAgreed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [errors, setErrors] = useState<ManualFoodErrors>({});

  useEffect(() => {
    if (Object.keys(errors).length) errorSummary.current?.focus();
  }, [errors]);

  function addFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    const result = validateManualFood(new FormData(event.currentTarget));
    if (!result.success) { setErrors(result.errors); return; }
    submitted.current = true;
    setAdding(true);
    addManualFood({ ...result.food, id: crypto.randomUUID(), noticeVersion: manualFoodNoticeVersion });
    router.push('/business/onboarding/purchases');
  }

  return (
    <section className={styles.entry} aria-labelledby="manual-food-title">
      <header>
        <h1 id="manual-food-title" className={styles.heading}>Lebensmittel manuell hinzufügen</h1>
        <p className={styles.basisNotice}>
          Alle Nährwerte müssen sich auf <strong>100 g oder 100 ml</strong> beziehen.
          Wähle die passende Bezugsmenge und übertrage die Angaben vom Produktetikett oder Lieferanten.
        </p>
      </header>
      <form onSubmit={addFood} noValidate aria-busy={adding}>
        <p className={styles.note}>Alle Felder sind erforderlich. Fehlende Werte nicht als 0 eintragen.</p>
        {Object.keys(errors).length > 0 && <p ref={errorSummary} tabIndex={-1} className={styles.error} role="alert">Bitte prüfe die markierten Felder.</p>}
        <fieldset className={styles.fields} disabled={adding}>
          <legend className={styles.visuallyHidden}>Lebensmittel und Nährwerte</legend>
          <div className={styles.field}>
            <label htmlFor="manual-name">Name des Lebensmittels</label>
            <input id="manual-name" name="name" type="text" required aria-invalid={!!errors.name} aria-describedby={errors.name ? 'manual-name-error' : undefined} />
            {errors.name && <span id="manual-name-error" className={styles.error}>{errors.name}</span>}
          </div>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="manual-basis">Nährwerte pro</label>
              <select id="manual-basis" name="basis" required defaultValue="" aria-invalid={!!errors.basis} aria-describedby={errors.basis ? 'manual-basis-error' : undefined}>
                <option value="" disabled>Bitte auswählen</option><option value="100g">100 g</option><option value="100ml">100 ml</option>
              </select>
              {errors.basis && <span id="manual-basis-error" className={styles.error}>{errors.basis}</span>}
            </div>
            <div className={styles.field}>
              <label htmlFor="manual-preparation">Zustand des Lebensmittels</label>
              <select id="manual-preparation" name="preparation" required defaultValue="" aria-invalid={!!errors.preparation} aria-describedby={errors.preparation ? 'manual-preparation-error' : undefined}>
                <option value="" disabled>Bitte auswählen</option><option value="as_sold">Wie verkauft</option><option value="prepared">Zubereitet</option>
              </select>
              {errors.preparation && <span id="manual-preparation-error" className={styles.error}>{errors.preparation}</span>}
            </div>
          </div>
          <div className={styles.tableWrapper} role="region" aria-label="Nährwerte eingeben" tabIndex={0}>
            <table className={styles.table}>
              <caption>Nährwerte je ausgewählter Bezugsmenge (100 g / 100 ml)</caption>
              <thead><tr><th scope="col">Nährwert</th><th scope="col">Wert</th><th scope="col">Einheit</th></tr></thead>
              <tbody>
                {nutrients.map(({ key, label, unit }) => (
                  <tr key={key}>
                    <th scope="row"><label htmlFor={`manual-${key}`}>{label}</label></th>
                    <td>
                      <input id={`manual-${key}`} name={key} type="text" inputMode="decimal" required aria-invalid={!!errors[key]} aria-describedby={`manual-${key}-unit${errors[key] ? ` manual-${key}-error` : ''}`} />
                      {errors[key] && <span id={`manual-${key}-error`} className={styles.error}>{errors[key]}</span>}
                    </td>
                    <td id={`manual-${key}-unit`}>{unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.field}>
            <label htmlFor="manual-sourceKind">Quelle der Nährwerte</label>
            <select id="manual-sourceKind" name="sourceKind" required defaultValue="" aria-invalid={!!errors.sourceKind} aria-describedby={errors.sourceKind ? 'manual-sourceKind-error' : undefined}>
              <option value="" disabled>Bitte auswählen</option><option value="label">Produktetikett</option><option value="supplier">Lieferantenangaben</option>
            </select>
            {errors.sourceKind && <span id="manual-sourceKind-error" className={styles.error}>{errors.sourceKind}</span>}
          </div>
          <div className={styles.field}>
            <label htmlFor="manual-sourceDescription">Quellenangabe (z. B. Produkt oder Lieferant und Datenblatt)</label>
            <input id="manual-sourceDescription" name="sourceDescription" type="text" required aria-invalid={!!errors.sourceDescription} aria-describedby={errors.sourceDescription ? 'manual-sourceDescription-error' : undefined} />
            {errors.sourceDescription && <span id="manual-sourceDescription-error" className={styles.error}>{errors.sourceDescription}</span>}
          </div>
          <p className={styles.note}>
            Deine Angaben werden zur Berechnung der Nährwerte deiner Gerichte verwendet.
            Fehlerhafte Angaben können die angezeigten Ergebnisse beeinflussen. Trage keine geschätzten Werte ein.
          </p>
          <label className={styles.consent}>
            <input name="consent" type="checkbox" required checked={agreed} onChange={event => setAgreed(event.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? 'manual-consent-error' : undefined} />
            <span>Ich habe die Hinweise gelesen und meine Angaben einschließlich der Bezugsmenge auf Richtigkeit und Vollständigkeit geprüft.</span>
          </label>
          {errors.consent && <p id="manual-consent-error" className={styles.error}>{errors.consent}</p>}
          <div className={styles.actions}>
            <Link className={styles.cancelLink} href="/business/onboarding/purchases">Abbrechen</Link>
            <button type="submit" className={styles.primaryButton} disabled={!agreed || adding}>{adding ? 'Wird hinzugefügt…' : 'Hinzufügen'}</button>
          </div>
        </fieldset>
        <p className={styles.note}>Die Einträge bleiben vorläufig und gehen beim Neuladen oder Abmelden verloren.</p>
      </form>
    </section>
  );
}
