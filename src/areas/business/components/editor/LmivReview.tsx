'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { ADDITIVES, ALLERGENS, type Recipe } from '../../data/dashboardModel';
import { saveLmiv, unpublishDish } from '../../data/saveLmivAction';
import { PhotoField } from './PhotoField';
import ui from '../dashboard/Dashboard.module.css';
import editor from './Editor.module.css';
import styles from './LmivReview.module.css';

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

function CheckboxGroup({ legend, options, checked, onToggle }: {
  legend: string;
  options: readonly { code: string; label: string }[];
  checked: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <fieldset className={styles.group}>
      <legend>{legend}</legend>
      <div className={styles.options}>
        {options.map(option => (
          <label key={option.code} className={styles.option}>
            <input type="checkbox" checked={checked.includes(option.code)} onChange={() => onToggle(option.code)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Figma „LMIV-Freigabe“: Allergene/Zusatzstoffe bestätigen, dann auf die Speisekarte
export function LmivReview({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [allergens, setAllergens] = useState<string[]>(recipe.allergens ?? []);
  const [additives, setAdditives] = useState<string[]>(recipe.additives ?? []);
  const [confirmed, setConfirmed] = useState(recipe.allergensConfirmed ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nutrition = recipe.nutrition;

  async function run(action: () => Promise<{ status: 'saved' } | { status: 'error'; message: string }>, href: string) {
    setSaving(true);
    setError(null);
    try {
      const result = await action();
      if (result.status === 'error') { setError(result.message); return; }
      router.push(href);
      router.refresh();
    } catch {
      setError('Das Speichern konnte nicht bestätigt werden. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  }
  const save = (publish: boolean) => run(() => saveLmiv({ key: recipe.slug, allergens, additives, publish }),
    publish ? '/business/menu' : '/business/aufgaben/lmiv-freigabe');

  // Jede Änderung an der Auswahl muss erneut bestätigt werden.
  const toggle = (setter: typeof setAllergens) => (option: string) => {
    setConfirmed(false);
    setter(current => current.includes(option) ? current.filter(entry => entry !== option) : [...current, option]);
  };

  return (
    <>
      <div className={editor.layout}>
        <section className={`${ui.card} ${ui.cardBordered}`} aria-labelledby="lmiv-title">
          <h2 id="lmiv-title" className={ui.cardTitle}>Allergene & Zusatzstoffe</h2>
          <p className={ui.cardText}>Wähle alle Allergene und Zusatzstoffe aus, die das Gericht enthält.</p>
          {recipe.published && <p className={ui.notice}>Dieses Gericht ist veröffentlicht. Änderungen hier müssen erneut bestätigt werden.</p>}
          <p className={ui.cardText}>Allergene werden noch nicht automatisch erkannt – bitte anhand der Zutaten prüfen.</p>
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

      {error && <p className={ui.errorNotice} role="alert">{error}</p>}

      <div className={styles.footer}>
        <label className={styles.confirm}>
          <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
          Ich bestätige die Richtigkeit der Allergen- und Zusatzstoffangaben.
        </label>
        <div className={editor.footer}>
          {recipe.published ? (
            <button className={`${ui.secondaryButton} ${ui.small}`} type="button" disabled={saving}
              onClick={() => void run(() => unpublishDish(recipe.slug), '/business/aufgaben/lmiv-freigabe')}>
              Von der Speisekarte nehmen
            </button>
          ) : (
            <button className={`${ui.secondaryButton} ${ui.small}`} type="button" disabled={saving} onClick={() => void save(false)}
              title="Auswahl speichern, ohne zu veröffentlichen">
              Später prüfen
            </button>
          )}
          <button
            className={`${ui.primaryButton} ${ui.large}`}
            type="button"
            disabled={!confirmed || !nutrition || saving}
            title={!nutrition ? 'Erst Zutaten und Mengen vervollständigen' : !confirmed ? 'Bitte die Angaben bestätigen' : undefined}
            onClick={() => void save(true)}
          >
            {saving ? 'Wird gespeichert…' : recipe.published ? 'Änderungen veröffentlichen' : 'Auf Speisekarte veröffentlichen'} <ArrowRight aria-hidden="true" size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
