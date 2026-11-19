'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown, Weight } from 'lucide-react';
import { BASIS_CATEGORIES, type Ingredient, type RecipeKind } from '../../data/dashboardModel';
import type { RestaurantFood } from '../../data/restaurantData';
import { saveDish } from '../../data/saveDashboardAction';
import { IngredientRows } from './IngredientRows';
import { PhotoField } from './PhotoField';
import ui from '../dashboard/Dashboard.module.css';
import styles from './Editor.module.css';

export interface RecipeEditorValues {
  ingredients: Ingredient[];
  category: string;
  cookedWeight: number | null;
  portionSize?: number;
  portionUnit?: string;
  price?: number;
  priceFromPos?: boolean;
  prepMinutes?: number;
}

/**
 * dish: vorhandenes Gericht in Supabase speichern; newDish: neues eigenes Gericht anlegen;
 * preview: Formular ohne Speicherziel (Basen gibt es noch nicht in der Datenbank) – „Speichern“ führt nur weiter.
 */
export type EditorSave =
  | { mode: 'dish'; key: string; href: string }
  | { mode: 'newDish'; href: string }
  | { mode: 'preview'; href: string };

interface RecipeEditorProps {
  kind: RecipeKind;
  initial: RecipeEditorValues;
  /** Überschrift der Zutatenkarte */
  ingredientsTitle: string;
  ingredientsHint?: string;
  /** Mengen hervorheben und Waage zeigen (Abwiegen / Einrichten) */
  weighing: boolean;
  /** Lebensmittel des Restaurants für die Zutatenauswahl */
  foods: RestaurantFood[];
  save: EditorSave;
  /** Optionaler Zweit-Button, z. B. „LMIV-Check öffnen“ */
  secondary?: { href: string; label: string };
}

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const euro = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function RecipeEditor({ kind, initial, ingredientsTitle, ingredientsHint, weighing, foods, save, secondary }: RecipeEditorProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState(initial.ingredients);
  const [category, setCategory] = useState(initial.category);
  const [cooked, setCooked] = useState(initial.cookedWeight?.toString() ?? '');
  const [portionSize, setPortionSize] = useState(initial.portionSize?.toString() ?? '1');
  const [price, setPrice] = useState(initial.price !== undefined ? euro.format(initial.price) : '');
  const [prep, setPrep] = useState(initial.prepMinutes?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const real = save.mode !== 'preview';
  const rawTotal = ingredients.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0);
  const cookedValue = toNumber(cooked);
  const loss = rawTotal > 0 && cookedValue !== undefined ? ((rawTotal - cookedValue) / rawTotal) * 100 : 0;
  const priceValue = toNumber(price);

  const quantitiesComplete = ingredients.every(entry => entry.quantity !== null && entry.quantity > 0);
  const complete = real
    // Gespeichert werden Zutaten, Mengen (und bei neuen Gerichten Name und Preis)
    ? quantitiesComplete && (save.mode !== 'newDish' || (name.trim() !== '' && ingredients.length > 0
      && (price.trim() === '' || (priceValue !== undefined && priceValue >= 0))))
    : ingredients.length > 0 && quantitiesComplete && cookedValue !== undefined && cookedValue > 0;
  const hint = save.mode === 'newDish'
    ? 'Bitte Namen, mindestens eine Zutat und alle Mengen eintragen'
    : real ? 'Bitte alle Mengen eintragen' : 'Bitte alle Mengen und das gekochte Endgewicht eintragen';

  async function submit() {
    if (save.mode === 'preview') { router.push(save.href); return; }
    setSaving(true);
    setError(null);
    try {
      const lines = ingredients.map(entry => ({
        foodId: entry.foodId ?? entry.id,
        quantity: String(entry.quantity),
        unit: entry.unit,
      }));
      const newFoods = ingredients.flatMap(entry => entry.catalogFood ? [entry.catalogFood] : []);
      const result = await saveDish(save.mode === 'dish'
        ? { key: save.key, lines, newFoods }
        : { newDish: { name: name.trim(), price: priceValue === undefined ? null : Math.round(priceValue * 100) / 100 }, lines, newFoods });
      if (result.status === 'error') { setError(result.message); return; }
      router.push(save.href);
      router.refresh();
    } catch {
      setError('Das Speichern konnte nicht bestätigt werden. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {save.mode === 'preview' && (
        <p className={ui.notice}>Basen gibt es noch nicht in der Datenbank. Eingaben werden noch nicht gespeichert.</p>
      )}

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          {save.mode === 'newDish' && (
            <section className={`${ui.card} ${ui.cardBordered}`} aria-label="Name des Gerichts">
              <label className={styles.labeled}>
                <span>Name des Gerichts</span>
                <span className={ui.field}>
                  <input value={name} maxLength={200} placeholder="z. B. Pizza Margherita" onChange={event => setName(event.target.value)} />
                </span>
              </label>
            </section>
          )}

          <section className={`${ui.card} ${ui.cardBordered} ${styles.ingredientsCard}`} aria-labelledby="ingredients-title">
            <h2 id="ingredients-title" className={ui.cardTitle}>{ingredientsTitle}</h2>
            {ingredientsHint && <p className={ui.cardText}>{ingredientsHint}</p>}
            <IngredientRows ingredients={ingredients} onChange={setIngredients} weighing={weighing} foods={foods} />
          </section>

          {kind === 'dish' && (
            <section className={`${ui.card} ${ui.cardBordered}`} aria-label="Portion, Preis und Zubereitung">
              <div className={styles.dishFields}>
                <label className={styles.labeled}>
                  <span>Portionsgröße</span>
                  <span className={`${ui.field} ${weighing && !real ? ui.fieldHighlight : ''}`}>
                    <input inputMode="decimal" value={portionSize} disabled={real} onChange={event => setPortionSize(event.target.value)} />
                    <span className={ui.fieldUnit}>{initial.portionUnit ?? 'Portion'}</span>
                  </span>
                </label>
                <label className={styles.labeled}>
                  <span>Verkaufspreis</span>
                  <span className={`${ui.field} ${weighing && !initial.priceFromPos ? ui.fieldHighlight : ''}`}>
                    <input
                      inputMode="decimal"
                      value={price}
                      disabled={save.mode === 'dish'}
                      title={initial.priceFromPos ? 'Preis kommt aus dem Kassensystem' : undefined}
                      onChange={event => setPrice(event.target.value)}
                    />
                    <span className={ui.fieldUnit}>€</span>
                  </span>
                </label>
                <label className={styles.labeled}>
                  <span>Zubereitungszeit</span>
                  <span className={ui.field}>
                    <input inputMode="numeric" value={prep} onChange={event => setPrep(event.target.value)} />
                    <span className={ui.fieldUnit}>Min.</span>
                  </span>
                </label>
              </div>
              {real && (
                <p className={styles.fieldsNote}>
                  Mengen gelten für 1 Portion. {save.mode === 'dish' && initial.priceFromPos ? 'Der Preis kommt aus dem Kassensystem. ' : ''}
                  Zubereitungszeit wird noch nicht gespeichert.
                </p>
              )}
            </section>
          )}
        </div>

        <div className={styles.sideColumn}>
          <PhotoField caption={kind === 'dish' ? 'Referenzfoto für den Gast hinzufügen' : 'Referenzfoto hinzufügen'} />

          <section className={`${ui.card} ${ui.cardBordered} ${styles.category}`}>
            <label className={styles.categoryLabel} htmlFor="recipe-category">Kategorie</label>
            {kind === 'basis' ? (
              <span className={`${ui.field} ${weighing ? ui.fieldHighlight : ''} ${styles.select}`}>
                <select id="recipe-category" value={category} onChange={event => setCategory(event.target.value)}>
                  {BASIS_CATEGORIES.map(entry => <option key={entry} value={entry}>{entry}</option>)}
                </select>
                <ChevronDown aria-hidden="true" size={16} />
              </span>
            ) : (
              // Gerichte: Warengruppe aus dem Kassensystem bzw. „Eigene Gerichte“
              <span id="recipe-category" className={styles.categoryValue}>{category}</span>
            )}
          </section>

          <section className={`${ui.card} ${ui.cardBordered}`} aria-labelledby="cooked-title">
            <h2 id="cooked-title" className={ui.cardTitle}>Gewicht nach dem Kochen</h2>
            <p className={styles.smallLabel}>Gesamtes Rohgewicht:</p>
            <p className={styles.rawTotal}>{number.format(rawTotal)} g</p>
            <p className={styles.smallLabel}>Gekochtes Endgewicht</p>
            <div className={styles.cookedRow}>
              <label className={`${ui.field} ${weighing && !real ? ui.fieldHighlight : ''} ${styles.quantity}`}>
                <span className={ui.fieldLabel}>Menge</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={cooked}
                  aria-label="Gekochtes Endgewicht"
                  onChange={event => setCooked(event.target.value)}
                />
                <span className={ui.fieldUnit}>g</span>
              </label>
              <button className={`${ui.iconButton} ${ui.iconButtonSmall} ${styles.scale}`} type="button" disabled title="Küchenwaage – folgt bald" aria-label="Mit der Waage wiegen (folgt bald)">
                <Weight aria-hidden="true" size={18} />
              </button>
            </div>
            {kind === 'basis' && (
              <div className={styles.loss}>
                <span>Berechneter Garverlust</span>
                <strong>{number.format(Math.max(loss, 0))} %</strong>
              </div>
            )}
            {real && <p className={styles.fieldsNote}>Wird noch nicht gespeichert.</p>}
          </section>
        </div>
      </div>

      {error && <p className={ui.errorNotice} role="alert">{error}</p>}

      <div className={styles.footer}>
        {secondary && (
          <Link className={`${ui.secondaryButton} ${ui.large}`} href={secondary.href}>{secondary.label}</Link>
        )}
        <button
          className={`${ui.primaryButton} ${ui.large}`}
          type="button"
          disabled={!complete || saving}
          title={complete ? undefined : hint}
          onClick={() => void submit()}
        >
          {saving ? 'Wird gespeichert…' : 'Speichern'} <ArrowRight aria-hidden="true" size={20} />
        </button>
      </div>
    </>
  );
}
