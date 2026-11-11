'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useBusinessDraft } from '../../state/BusinessDraftContext';
import { defaultRecipe, positiveAmount, recipeErrors } from '../../data/recipeDraft';
import type { RecipeFood } from '../../types/recipe';
import styles from './RecipeEditor.module.css';

export function RecipeEditor({ dishId }: { dishId: string }) {
  const { recipes, setRecipe, manualFoods, catalogFoods } = useBusinessDraft();
  const [foodId, setFoodId] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const foods: RecipeFood[] = [
    ...manualFoods.map(food => ({ ...food, sourceLabel: 'manuell' })),
    ...catalogFoods.map(food => ({ ...food, sourceLabel: food.source.kind === 'bls' ? 'BLS' : 'Open Food Facts' })),
  ];
  const recipe = { ...(recipes[dishId] ?? defaultRecipe()), servings: '1' };
  const available = foods.filter(food => !recipe.ingredients.some(line => line.foodId === food.id));
  const selectedFood = available.find(food => food.id === foodId);
  const errors = recipeErrors(recipe, foods);
  const prefix = `recipe-${dishId}`;

  function add() {
    if (!selectedFood) return;
    setRecipe(dishId, { ...recipe, ingredients: [...recipe.ingredients, { foodId: selectedFood.id, quantity: '',
      unit: selectedFood.basis === '100g' ? 'g' : selectedFood.basis === '100ml' ? 'ml' : '' }] });
    setFoodId('');
  }

  return (
    <section className={styles.editor} aria-labelledby={`${prefix}-title`}>
      <h3 id={`${prefix}-title`} className={styles.title}>Zutaten & Mengen</h3>
      <p className={styles.note}>Gib die Zutatenmengen für eine Portion dieses Gerichts an.</p>
      <div className={styles.addRow}>
        <label className={styles.field} htmlFor={`${prefix}-food`}>Lebensmittel aus deiner Liste
          <select id={`${prefix}-food`} value={foodId} onChange={event => setFoodId(event.target.value)}>
            <option value="">Lebensmittel auswählen</option>
            {available.map(food => <option key={food.id} value={food.id}>{food.name} · {food.sourceLabel}{food.preparation === 'prepared' ? ' · zubereitet' : ''}</option>)}
          </select>
        </label>
        <button className={styles.primaryButton} type="button" disabled={!selectedFood} onClick={add}>Zutat hinzufügen</button>
      </div>
      <Link className={styles.link} href="/business/onboarding/purchases">Weitere Lebensmittel suchen oder manuell hinzufügen</Link>
      {recipe.ingredients.length === 0 ? <p className={styles.note}>Noch keine Zutaten zugeordnet. Ohne Rezept bleibt dieses Gericht ein Entwurf.</p> : (
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
        </ul>
      )}
      {showErrors && errors.length > 0 && <ul className={styles.error} role="alert">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
      <p className={styles.note}>Deine Änderungen bleiben bis zum abschließenden Speichern vorläufig.</p>
    </section>
  );
}
