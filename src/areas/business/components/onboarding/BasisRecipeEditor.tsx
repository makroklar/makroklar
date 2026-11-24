'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { BasisRecipeDraft } from '../../data/basisOnboardingModel';
import { positiveAmount, recipeErrors } from '../../data/recipeDraft';
import { useBusinessDraft } from '../../state/BusinessDraftContext';
import type { RecipeFood } from '../../types/recipe';
import styles from './BasisRecipeEditor.module.css';

export function BasisRecipeEditor({ recipe, onRemoved }: { recipe: BasisRecipeDraft; onRemoved: () => void }) {
  const { manualFoods, catalogFoods, upsertBasisRecipe, removeBasisRecipe, dishBases } = useBusinessDraft();
  const [foodId, setFoodId] = useState('');
  const [unknownUnit, setUnknownUnit] = useState<'g' | 'ml' | ''>('');
  const [showErrors, setShowErrors] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const foods: RecipeFood[] = [
    ...manualFoods.map(food => ({ ...food, sourceLabel: 'manuell' })),
    ...catalogFoods.map(food => ({ ...food, sourceLabel: food.source.kind === 'bls' ? 'BLS' : 'Open Food Facts' })),
  ];
  const available = foods.filter(food => !recipe.ingredients.some(line => line.foodId === food.id));
  const selectedFood = available.find(food => food.id === foodId);
  const selectedUnit = selectedFood?.basis === '100g' ? 'g' : selectedFood?.basis === '100ml' ? 'ml' : unknownUnit;
  const useCount = Object.values(dishBases).filter(lines => lines.some(line => line.basisId === recipe.id)).length;
  const prefix = `basis-${recipe.id}`;
  const outputInvalid = recipe.outputQuantity !== null && positiveAmount(recipe.outputQuantity) === null;
  const errors = recipeErrors({ servings: '1', ingredients: recipe.ingredients }, foods);
  if (!recipe.name.trim()) errors.unshift('Bitte einen Namen für das Basisrezept eingeben.');
  if (outputInvalid) errors.push('Bitte eine Nettomenge größer als 0 eingeben (maximal 1.000.000), oder das Feld vorerst leer lassen.');

  function update(changes: Partial<BasisRecipeDraft>) {
    upsertBasisRecipe({ ...recipe, ...changes });
  }

  function addIngredient() {
    if (!selectedFood || !selectedUnit) return;
    update({ ingredients: [...recipe.ingredients, { foodId: selectedFood.id, quantity: '', unit: selectedUnit }] });
    setFoodId('');
    setUnknownUnit('');
  }

  return (
    <div className={styles.editor}>
      <label className={styles.field} htmlFor={`${prefix}-name`}>Name des Basisrezepts
        <input id={`${prefix}-name`} value={recipe.name} maxLength={500}
          aria-invalid={showErrors && !recipe.name.trim()} onBlur={() => setShowErrors(true)}
          onChange={event => update({ name: event.target.value })} />
      </label>

      <h3 className={styles.title}>Zutaten für die gesamte Zubereitung</h3>
      <p className={styles.note}>Gib alle Lebensmittel und Mengen an, die du für dieses Basisrezept verwendest.</p>
      <div className={styles.addRow}>
        <label className={styles.field} htmlFor={`${prefix}-food`}>Lebensmittel aus deiner Liste
          <select id={`${prefix}-food`} value={foodId} onChange={event => { setFoodId(event.target.value); setUnknownUnit(''); }}>
            <option value="">Lebensmittel auswählen</option>
            {available.map(food => <option key={food.id} value={food.id}>{food.name} · {food.sourceLabel}{food.preparation === 'prepared' ? ' · zubereitet' : ''}</option>)}
          </select>
        </label>
        {selectedFood && selectedFood.basis === null && <label className={styles.field} htmlFor={`${prefix}-add-unit`}>Einheit
          <select id={`${prefix}-add-unit`} value={unknownUnit} onChange={event => setUnknownUnit(event.target.value as typeof unknownUnit)}>
            <option value="">Auswählen</option><option value="g">g</option><option value="ml">ml</option>
          </select>
        </label>}
        <button className={styles.primaryButton} type="button" disabled={!selectedFood || !selectedUnit} onClick={addIngredient}>Zutat hinzufügen</button>
      </div>
      <Link className={styles.link} href="/business/onboarding/purchases">Weitere Lebensmittel hinzufügen</Link>
      {recipe.ingredients.length === 0 ? <p className={styles.note}>Noch keine Zutaten zugeordnet.</p> : (
        <ul className={styles.lines}>
          {recipe.ingredients.map(line => {
            const food = foods.find(item => item.id === line.foodId);
            const inputId = `${prefix}-${line.foodId}`;
            return <li className={styles.line} key={line.foodId}>
              <div className={styles.foodName}>{food?.name ?? 'Lebensmittel nicht mehr in der Liste'}
                <small>{food ? `${food.sourceLabel} · ${food.basis === '100g' ? 'je 100 g' : food.basis === '100ml' ? 'je 100 ml' : 'Bezugsmenge unbekannt – Nährwerte nicht berechenbar'}` : 'Bitte erneut hinzufügen oder diese Zuordnung entfernen.'}</small>
              </div>
              <label className={styles.field} htmlFor={inputId}>Menge
                <input id={inputId} inputMode="decimal" value={line.quantity} maxLength={30} placeholder="z. B. 250"
                  aria-invalid={showErrors && positiveAmount(line.quantity) === null} onBlur={() => setShowErrors(true)}
                  onChange={event => update({ ingredients: recipe.ingredients.map(item => item.foodId === line.foodId ? { ...item, quantity: event.target.value } : item) })} />
              </label>
              <label className={styles.field} htmlFor={`${inputId}-unit`}>Einheit
                <select id={`${inputId}-unit`} value={line.unit} disabled={food?.basis != null}
                  onChange={event => update({ ingredients: recipe.ingredients.map(item => item.foodId === line.foodId ? { ...item, unit: event.target.value as 'g' | 'ml' } : item) })}>
                  <option value="g">g</option><option value="ml">ml</option>
                </select>
              </label>
              <button className={styles.textButton} type="button" aria-label={`${food?.name ?? 'Zutat'} aus dem Basisrezept entfernen`}
                onClick={() => update({ ingredients: recipe.ingredients.filter(item => item.foodId !== line.foodId) })}>Entfernen</button>
            </li>;
          })}
        </ul>
      )}

      <h3 className={styles.title}>Wie viel ergibt dein fertiges Basisrezept?</h3>
      <p className={styles.note} id={`${prefix}-output-help`}>Miss die gesamte Nettomenge nach der Zubereitung, ohne Behälter.
        Zum Beispiel: 800 g fertige Tomatensauce. Nicht automatisch die Zutatenmengen addieren.</p>
      <div className={styles.outputRow}>
        <label className={styles.field} htmlFor={`${prefix}-output`}>Nettomenge (optional)
          <input id={`${prefix}-output`} inputMode="decimal" value={recipe.outputQuantity ?? ''} maxLength={30}
            aria-describedby={`${prefix}-output-help`} aria-invalid={showErrors && outputInvalid}
            placeholder="z. B. 800" onBlur={() => setShowErrors(true)}
            onChange={event => update({ outputQuantity: event.target.value.trim() === '' ? null : event.target.value })} />
        </label>
        <label className={styles.field} htmlFor={`${prefix}-output-unit`}>Einheit des fertigen Rezepts
          <select id={`${prefix}-output-unit`} value={recipe.outputUnit} disabled={useCount > 0}
            onChange={event => update({ outputUnit: event.target.value as 'g' | 'ml' })}>
            <option value="g">g</option><option value="ml">ml</option>
          </select>
        </label>
      </div>
      {recipe.outputQuantity === null && <p className={styles.note}>Ohne Nettomenge bleibt die Basis ein Entwurf. Für die spätere Berechnung pro 100 g oder 100 ml wird diese Menge benötigt.</p>}
      {showErrors && errors.length > 0 && <ul className={styles.error} role="alert">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}

      <div className={styles.removeArea}>
        {useCount > 0 ? <p className={styles.note}>In {useCount} Gericht(en) verwendet. Entferne dort zuerst die Verknüpfungen, bevor du diese Basis löschst oder ihre Einheit änderst.</p> : confirmRemoval ? (
          <div role="group" aria-label="Basisrezept entfernen bestätigen">
            <p>„{recipe.name || 'Dieses Basisrezept'}“ aus deiner Liste entfernen?</p>
            <div className={styles.removeActions}>
              <button className={styles.textButton} type="button" onClick={() => setConfirmRemoval(false)}>Behalten</button>
              <button className={styles.textButton} type="button" onClick={() => { removeBasisRecipe(recipe.id); onRemoved(); }}>Ja, entfernen</button>
            </div>
          </div>
        ) : <button className={styles.textButton} type="button" onClick={() => setConfirmRemoval(true)}>Basisrezept entfernen</button>}
      </div>
    </div>
  );
}
