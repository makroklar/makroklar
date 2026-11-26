'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useBusinessDraft } from '../../state/BusinessDraftContext';
import { defaultRecipe, positiveAmount, recipeErrors } from '../../data/recipeDraft';
import { basisRecipeSchema } from '../../data/basisOnboardingModel';
import type { RecipeFood } from '../../types/recipe';
import styles from './RecipeEditor.module.css';

export function RecipeEditor({ dishId }: { dishId: string }) {
  const { recipes, setRecipe, manualFoods, catalogFoods, basisRecipes, dishBases, setDishBases, basisError, basisPersistenceReady } = useBusinessDraft();
  const [selectionId, setSelectionId] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const foods: RecipeFood[] = [
    ...manualFoods.map(food => ({ ...food, sourceLabel: 'manuell' })),
    ...catalogFoods.map(food => ({ ...food, sourceLabel: food.source.kind === 'bls' ? 'BLS' : 'Open Food Facts' })),
  ];
  const recipe = { ...(recipes[dishId] ?? defaultRecipe()), servings: '1' };
  const available = foods.filter(food => !recipe.ingredients.some(line => line.foodId === food.id));
  const basisLines = dishBases[dishId] ?? [];
  const availableBases = basisRecipes.filter(basis => !basisLines.some(line => line.basisId === basis.id));
  const selectedFood = available.find(food => `food:${food.id}` === selectionId);
  const selectedBasis = availableBases.find(basis => `basis:${basis.id}` === selectionId);
  const errors = recipeErrors(recipe, foods);
  for (const line of basisLines) {
    const basis = basisRecipes.find(item => item.id === line.basisId);
    if (!basis) errors.push('Ein zugeordnetes Basisrezept fehlt. Bitte entferne diese Zuordnung.');
    if (positiveAmount(line.quantity) === null) errors.push(`${basis?.name || 'Basisrezept'}: Bitte eine Menge größer als 0 eingeben (maximal 1.000.000).`);
    if (basis && line.unit !== basis.outputUnit) errors.push(`${basis.name}: Die Einheit muss zum Basisrezept passen.`);
  }
  const prefix = `recipe-${dishId}`;

  function add() {
    if (selectedBasis) {
      setDishBases(dishId, [...basisLines, { basisId: selectedBasis.id, quantity: '', unit: selectedBasis.outputUnit }]);
    } else if (selectedFood) {
      setRecipe(dishId, { ...recipe, ingredients: [...recipe.ingredients, { foodId: selectedFood.id, quantity: '',
        unit: selectedFood.basis === '100g' ? 'g' : selectedFood.basis === '100ml' ? 'ml' : '' }] });
    } else return;
    setSelectionId('');
  }

  return (
    <section className={styles.editor} aria-labelledby={`${prefix}-title`}>
      <h3 id={`${prefix}-title`} className={styles.title}>Zutaten & Mengen</h3>
      <p className={styles.note}>Gib die Zutatenmengen für eine Portion dieses Gerichts an.</p>
      <div className={styles.addRow}>
        <label className={styles.field} htmlFor={`${prefix}-food`}>Lebensmittel oder Basisrezept aus deiner Liste
          <select id={`${prefix}-food`} value={selectionId} onChange={event => setSelectionId(event.target.value)}>
            <option value="">Zutat auswählen</option>
            {available.length > 0 && <optgroup label="Lebensmittel">
              {available.map(food => <option key={food.id} value={`food:${food.id}`}>{food.name} · {food.sourceLabel}{food.preparation === 'prepared' ? ' · zubereitet' : ''}</option>)}
            </optgroup>}
            {availableBases.length > 0 && <optgroup label="Basisrezepte">
              {availableBases.map(basis => <option key={basis.id} value={`basis:${basis.id}`}>{basis.name.trim() || 'Basisrezept ohne Namen'} · {basis.outputUnit}</option>)}
            </optgroup>}
          </select>
        </label>
        <button className={styles.primaryButton} type="button" disabled={!selectedFood && !selectedBasis} onClick={add}>Zutat hinzufügen</button>
      </div>
      <div className={styles.links}>
        <Link className={styles.link} href="/business/onboarding/purchases">Weitere Lebensmittel suchen oder manuell hinzufügen</Link>
        <Link className={styles.link} href="/business/onboarding/bases">Basisrezepte erstellen oder bearbeiten</Link>
      </div>
      {basisError && <p className={styles.error} role="alert">{basisError}</p>}
      {recipe.ingredients.length === 0 && basisLines.length === 0 ? <p className={styles.note}>Noch keine Zutaten zugeordnet. Ohne Rezept bleibt dieses Gericht ein Entwurf.</p> : (
        <ul className={styles.lines}>
          {recipe.ingredients.map(line => {
            const food = foods.find(item => item.id === line.foodId);
            const inputId = `${prefix}-${line.foodId}`;
            return <li className={styles.line} key={line.foodId}>
              <div className={styles.foodName}>{food?.name ?? 'Lebensmittel nicht mehr in der Liste'}
                <small>{food ? `${food.sourceLabel} · ${food.basis === '100g' ? 'je 100 g' : food.basis === '100ml' ? 'je 100 ml' : 'Bezugsmenge unbekannt'}` : 'Bitte erneut hinzufügen oder diese Zuordnung entfernen.'}</small>
              </div>
              <label className={styles.field} htmlFor={inputId}>Menge
                <input id={inputId} inputMode="decimal" value={line.quantity} placeholder="z. B. 150"
                  aria-invalid={showErrors && positiveAmount(line.quantity) === null}
                  onBlur={() => setShowErrors(true)} maxLength={20}
                  onChange={event => setRecipe(dishId, { ...recipe, ingredients: recipe.ingredients.map(item => item.foodId === line.foodId ? { ...item, quantity: event.target.value } : item) })} />
              </label>
              <label className={styles.field} htmlFor={`${inputId}-unit`}>Einheit
                <select id={`${inputId}-unit`} value={line.unit} disabled={food?.basis != null}
                  onChange={event => setRecipe(dishId, { ...recipe, ingredients: recipe.ingredients.map(item => item.foodId === line.foodId ? { ...item, unit: event.target.value as 'g' | 'ml' | '' } : item) })}>
                  <option value="">Auswählen</option><option value="g">g</option><option value="ml">ml</option>
                </select>
              </label>
              <button className={styles.textButton} type="button" aria-label={`${food?.name ?? 'Zutat'} aus dem Rezept entfernen`}
                onClick={() => setRecipe(dishId, { ...recipe, ingredients: recipe.ingredients.filter(item => item.foodId !== line.foodId) })}>Entfernen</button>
            </li>;
          })}
          {basisLines.map(line => {
            const basis = basisRecipes.find(item => item.id === line.basisId);
            const inputId = `${prefix}-basis-${line.basisId}`;
            const incomplete = basis && (!basisRecipeSchema.safeParse(basis).success || basis.outputQuantity === null
              || basis.ingredients.length === 0 || recipeErrors({ servings: '1', ingredients: basis.ingredients }, foods).length > 0);
            return <li className={styles.line} key={`basis:${line.basisId}`}>
              <div className={styles.foodName}>{basis?.name.trim() || 'Basisrezept nicht verfügbar'}
                <small>Basisrezept{basis?.outputQuantity ? ` · Gesamte Nettomenge: ${basis.outputQuantity} ${basis.outputUnit}` : ''}</small>
                {incomplete && <small>Rezeptangaben unvollständig. Bitte das Basisrezept ergänzen; die Nährwerte bleiben vorerst offen.</small>}
                {!basis && <small>Bitte diese Zuordnung entfernen.</small>}
              </div>
              <label className={styles.field} htmlFor={inputId}>Menge
                <input id={inputId} inputMode="decimal" value={line.quantity} placeholder="z. B. 250" maxLength={30}
                  aria-invalid={showErrors && positiveAmount(line.quantity) === null} onBlur={() => setShowErrors(true)}
                  onChange={event => setDishBases(dishId, basisLines.map(item => item.basisId === line.basisId ? { ...item, quantity: event.target.value } : item))} />
              </label>
              <label className={styles.field} htmlFor={`${inputId}-unit`}>Einheit
                <select id={`${inputId}-unit`} value={line.unit} disabled>
                  <option value="g">g</option><option value="ml">ml</option>
                </select>
              </label>
              <button className={styles.textButton} type="button" aria-label={`${basis?.name || 'Basisrezept'} aus dem Gericht entfernen`}
                onClick={() => setDishBases(dishId, basisLines.filter(item => item.basisId !== line.basisId))}>Entfernen</button>
            </li>;
          })}
        </ul>
      )}
      {showErrors && errors.length > 0 && <ul className={styles.error} role="alert">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
      {basisLines.length > 0 && <p className={styles.note}>Die Menge bezieht sich auf das fertige Basisrezept für eine Portion dieses Gerichts.
        {' '}{basisPersistenceReady ? 'Die Verknüpfungen werden mit „Einrichtung abschließen“ gespeichert.'
          : 'Neue Verknüpfungen bleiben aktuell nur in dieser Sitzung erhalten; die erweiterte Rezept-Speicherung ist noch nicht verfügbar.'}</p>}
      <p className={styles.note}>Deine Änderungen bleiben bis zum abschließenden Speichern vorläufig.</p>
    </section>
  );
}
