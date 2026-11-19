'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { ADDITIVES, ALLERGENS, type Recipe } from '../../data/dashboardModel';
import { PhotoField } from './PhotoField';
import ui from '../dashboard/Dashboard.module.css';
import editor from './Editor.module.css';
import styles from './LmivReview.module.css';

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

function CheckboxGroup({ legend, options, checked, onToggle }: {
  legend: string;
  options: readonly string[];
  checked: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <fieldset className={styles.group}>
      <legend>{legend}</legend>
      <div className={styles.options}>
        {options.map(option => (
          <label key={option} className={styles.option}>
            <input type="checkbox" checked={checked.includes(option)} onChange={() => onToggle(option)} />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Figma „LMIV-Freigabe“: Allergene/Zusatzstoffe bestätigen, dann auf die Speisekarte
export function LmivReview({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [allergens, setAllergens] = useState<string[]>([]);
  const [additives, setAdditives] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const nutrition = recipe.nutrition;

  const toggle = (setter: typeof setAllergens) => (option: string) =>
    setter(current => current.includes(option) ? current.filter(entry => entry !== option) : [...current, option]);

  return (
    <>
      <div className={editor.layout}>
        <section className={`${ui.card} ${ui.cardBordered}`} aria-labelledby="lmiv-title">
          <h2 id="lmiv-title" className={ui.cardTitle}>Allergene & Zusatzstoffe</h2>
          <p className={ui.cardText}>Wähle alle Allergene und Zusatzstoffe aus, die das Gericht enthält.</p>
          <p className={ui.notice}>Allergene werden noch nicht automatisch erkannt und noch nicht gespeichert – dafür fehlt die Tabelle in der Datenbank.</p>
          <CheckboxGroup legend="Allergene" options={ALLERGENS} checked={allergens} onToggle={toggle(setAllergens)} />
          <CheckboxGroup legend="Zusatzstoffe" options={ADDITIVES} checked={additives} onToggle={toggle(setAdditives)} />
        </section>

        <div className={editor.sideColumn}>
          <PhotoField caption="Referenzfoto für den Gast hinzufügen" />

          <section className={`${ui.card} ${ui.cardBordered}`} aria-labelledby="general-title">
            <h2 id="general-title" className={ui.cardTitle}>Allgemeine Angaben</h2>
            <ul className={styles.facts}>
              <li>Zutaten: {recipe.ingredients.map(entry => entry.name).join(', ')}</li>
              <li>Kategorie: {recipe.category}</li>
              {recipe.prepMinutes !== undefined && <li>Ø Zubereitungszeit: {recipe.prepMinutes} Min.</li>}
              <li>{recipe.portion?.size ?? 1} {recipe.portion?.size === 1 || !recipe.portion ? 'Portion' : 'Portionen'}</li>
            </ul>
          </section>

          <section className={`${ui.card} ${ui.cardBordered}`} aria-labelledby="nutrition-title">
            <h2 id="nutrition-title" className={ui.cardTitle}>Berechnete Nährwerte pro Portion</h2>
            {nutrition ? (
            <dl className={styles.nutrition}>
              <div><dt>Kalorien:</dt><dd>{number.format(nutrition.energyKcal)} Kcal</dd></div>
              <div><dt>Kohlenhydrate:</dt><dd>{number.format(nutrition.carbohydrateG)} g</dd></div>
              <div><dt>Fett:</dt><dd>{number.format(nutrition.fatG)} g</dd></div>
              <div><dt>FPE:</dt><dd>{number.format(nutrition.fpe)}</dd></div>
              <div><dt>Protein:</dt><dd>{number.format(nutrition.proteinG)} g</dd></div>
            </dl>
            ) : (
              <p className={styles.incomplete}>Noch unvollständig – bitte zuerst Zutaten und Mengen eintragen.</p>
            )}
          </section>
        </div>
      </div>

      <div className={styles.footer}>
        <label className={styles.confirm}>
          <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
          Ich bestätige die Richtigkeit der Allergen- und Zusatzstoffangaben.
        </label>
        <div className={editor.footer}>
          <button className={`${ui.secondaryButton} ${ui.small}`} type="button" onClick={() => router.push('/business')}>
            Später prüfen
          </button>
          <button
            className={`${ui.primaryButton} ${ui.large}`}
            type="button"
            disabled={!confirmed || !nutrition}
            onClick={() => router.push('/business/menu')}
          >
            Auf Speisekarte veröffentlichen <ArrowRight aria-hidden="true" size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
