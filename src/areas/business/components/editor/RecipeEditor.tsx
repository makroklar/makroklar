'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown, Info } from 'lucide-react';
import { IconWeightKg } from '@/shared/components/icons/IconWeightKg';
import { BASIS_CATEGORIES, DISH_CATEGORIES, guessDishCategory, type Ingredient, type RecipeKind } from '../../data/dashboardModel';
import type { RestaurantFood } from '../../data/restaurantData';
import { saveBasis, saveDish } from '../../data/saveDashboardAction';
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
 * dish / basis: vorhandenes Gericht bzw. Basisrezept in Supabase speichern; newDish / newBasis: neu anlegen;
 * preview: Formular ohne Speicherziel – „Speichern“ führt nur weiter.
 */
export type EditorSave =
  | { mode: 'dish'; key: string; href: string }
  | { mode: 'newDish'; href: string }
  | { mode: 'basis'; id: string; href: string }
  | { mode: 'newBasis'; href: string }
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
  // Gerichte: Startwert aus der Warengruppe der Kasse ableiten
  const [category, setCategory] = useState(kind === 'dish' ? guessDishCategory(initial.category) : initial.category);
  const [cooked, setCooked] = useState(initial.cookedWeight?.toString() ?? '');
  const [portionSize, setPortionSize] = useState(initial.portionSize?.toString() ?? '1');
  const [price, setPrice] = useState(initial.price !== undefined ? euro.format(initial.price) : '');
  const [prep, setPrep] = useState(initial.prepMinutes?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const real = save.mode !== 'preview';
  const isNew = save.mode === 'newDish' || save.mode === 'newBasis';
  const basisSave = save.mode === 'basis' || save.mode === 'newBasis';
  const rawTotal = ingredients.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0);
  const cookedValue = toNumber(cooked);
  const loss = rawTotal > 0 && cookedValue !== undefined ? ((rawTotal - cookedValue) / rawTotal) * 100 : 0;
  const priceValue = toNumber(price);

  const quantitiesComplete = ingredients.every(entry => entry.quantity !== null && entry.quantity > 0);
  // Basen: gekochtes Endgewicht ist optional, muss aber größer als 0 sein, wenn es eingetragen ist
  const cookedValid = cooked.trim() === '' || (cookedValue !== undefined && cookedValue > 0 && cookedValue <= 1_000_000);
  const complete = basisSave
    ? quantitiesComplete && cookedValid && (save.mode !== 'newBasis' || (name.trim() !== '' && ingredients.length > 0))
    : real
      // Gespeichert werden Zutaten, Mengen (und bei neuen Gerichten Name und Preis)
      ? quantitiesComplete && (save.mode !== 'newDish' || (name.trim() !== '' && ingredients.length > 0
        && (price.trim() === '' || (priceValue !== undefined && priceValue >= 0))))
      : ingredients.length > 0 && quantitiesComplete && cookedValue !== undefined && cookedValue > 0;
  const hint = isNew
    ? 'Bitte Namen, mindestens eine Zutat und alle Mengen eintragen'
    : basisSave ? 'Bitte alle Mengen und ein gekochtes Gewicht größer als 0 eintragen'
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
      const cookedWeight = cookedValue === undefined ? null : String(cookedValue);
      const result = save.mode === 'basis' ? await saveBasis({ id: save.id, lines, newFoods, cookedWeight })
        : save.mode === 'newBasis' ? await saveBasis({ newBasis: { name: name.trim() }, lines, newFoods, cookedWeight })
          : await saveDish(save.mode === 'dish'
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
          {isNew && (
            <section className={`${ui.card} ${ui.cardBordered}`} aria-label={kind === 'basis' ? 'Name der Basis' : 'Name des Gerichts'}>
              <label className={styles.labeled}>
                <span>{kind === 'basis' ? 'Name der Basis' : 'Name des Gerichts'}</span>
                <span className={ui.field}>
                  <input value={name} maxLength={kind === 'basis' ? 500 : 200} placeholder={kind === 'basis' ? 'z. B. Tomatensauce' : 'z. B. Pizza Margherita'} onChange={event => setName(event.target.value)} />
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
                <div className={styles.labeled}>
                  <span className={styles.labelRow}>
                    <label htmlFor="dish-price">Verkaufspreis</label>
                    {initial.priceFromPos && (
                      <>
                        <button className={styles.posBadge} type="button" popoverTarget="dish-price-pos" aria-label="Preis aus dem Kassensystem – mehr erfahren">
                          <Info aria-hidden="true" size={12} />
                          Kasse
                        </button>
                        <span id="dish-price-pos" className={styles.posInfo} popover="auto" role="note">
                          Der Verkaufspreis kommt aus deinem Kassensystem und kann hier nicht geändert werden. Passe ihn in der Kasse an, dann wird er übernommen.
                        </span>
                      </>
                    )}
                  </span>
                  <span className={`${ui.field} ${weighing && save.mode !== 'dish' ? ui.fieldHighlight : ''}`}>
                    <input
                      id="dish-price"
                      inputMode="decimal"
                      value={price}
                      disabled={save.mode === 'dish'}
                      onChange={event => setPrice(event.target.value)}
                    />
                    <span className={ui.fieldUnit}>€</span>
                  </span>
                </div>
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
                  Mengen gelten für 1 Portion. Kategorie und Zubereitungszeit werden noch nicht gespeichert.
                </p>
              )}
            </section>
          )}
        </div>

        <div className={styles.sideColumn}>
          <PhotoField caption={kind === 'dish' ? 'Referenzfoto für den Gast hinzufügen' : 'Referenzfoto hinzufügen'} />

          <section className={`${ui.card} ${ui.cardBordered} ${styles.category}`}>
            <label className={styles.categoryLabel} htmlFor="recipe-category">Kategorie</label>
            <span className={`${ui.field} ${weighing && (kind === 'basis' || category === '') ? ui.fieldHighlight : ''} ${styles.select}`}>
              <select id="recipe-category" value={category} onChange={event => setCategory(event.target.value)}>
                {category === '' && <option value="" disabled>Bitte wählen</option>}
                {(kind === 'basis' ? BASIS_CATEGORIES : DISH_CATEGORIES).map(entry => <option key={entry} value={entry}>{entry}</option>)}
              </select>
              <ChevronDown aria-hidden="true" size={16} />
            </span>
            {basisSave && <p className={styles.fieldsNote}>Wird noch nicht gespeichert.</p>}
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
                <IconWeightKg size={18} />
              </button>
            </div>
            {kind === 'basis' && (
              <div className={styles.loss}>
                <span>Berechneter Garverlust</span>
                <strong>{number.format(Math.max(loss, 0))} %</strong>
              </div>
            )}
            {real && !basisSave && <p className={styles.fieldsNote}>Wird noch nicht gespeichert.</p>}
            {basisSave && <p className={styles.fieldsNote}>Gesamtgewicht der fertigen Basis. Ohne dieses Gewicht bleiben die Nährwerte offen.</p>}
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
