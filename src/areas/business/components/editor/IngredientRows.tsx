'use client';

import { useState } from 'react';
import { Pencil, Plus, ScanLine, Trash2 } from 'lucide-react';
import { IconWeightKg } from '@/shared/components/icons/IconWeightKg';
import type { Ingredient } from '../../data/dashboardModel';
import type { RestaurantFood } from '../../data/restaurantData';
import { IngredientPicker, type PickedIngredient } from './IngredientPicker';
import ui from '../dashboard/Dashboard.module.css';
import styles from './Editor.module.css';

interface IngredientRowsProps {
  ingredients: Ingredient[];
  onChange: (ingredients: Ingredient[]) => void;
  /** Mengenfelder hervorheben (Abwiegen) und Waage-Button zeigen */
  weighing?: boolean;
  foods: RestaurantFood[];
}

export function IngredientRows({ ingredients, onChange, weighing = false, foods }: IngredientRowsProps) {
  // null = Picker zu, 'add' = neue Zutat, sonst ID der Zutat, die ersetzt wird
  const [picker, setPicker] = useState<null | 'add' | string>(null);

  function update(id: string, patch: Partial<Ingredient>) {
    onChange(ingredients.map(entry => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function pick(picked: PickedIngredient) {
    if (picker === 'add') {
      const id = ingredients.some(entry => entry.id === picked.id) ? `${picked.id}-${Date.now()}` : picked.id;
      onChange([...ingredients, { ...picked, id, foodId: picked.foodId ?? picked.id, quantity: null }]);
    } else if (picker) {
      onChange(ingredients.map(entry => entry.id === picker
        ? { ...entry, ...picked, id: entry.id, foodId: picked.foodId ?? picked.id } : entry));
    }
    setPicker(null);
  }

  return (
    <>
      {ingredients.length > 0 && (
        <ul className={ui.list}>
          {ingredients.map(entry => (
            <li key={entry.id} className={`${ui.row} ${styles.ingredient}`}>
              <span className={ui.rowText}>
                <span className={ui.rowTitle}>{entry.name}</span>
                <span className={styles.supplier}>{entry.supplier}</span>
              </span>
              <span className={styles.ingredientActions}>
                <label className={`${ui.field} ${styles.quantity} ${weighing ? ui.fieldHighlight : ''}`}>
                  <span className={ui.fieldLabel}>Menge</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={entry.quantity ?? ''}
                    aria-label={`Menge ${entry.name}`}
                    onChange={event => update(entry.id, { quantity: event.target.value === '' ? null : Number(event.target.value) })}
                  />
                  {entry.basis === '100g' || entry.basis === '100ml' ? (
                    // Einheit steht durch die Nährwertangabe fest – keine Auswahl nötig
                    <span className={ui.fieldUnit}>{entry.unit}</span>
                  ) : (
                    <select
                      className={styles.unit}
                      value={entry.unit}
                      aria-label={`Einheit ${entry.name}`}
                      onChange={event => update(entry.id, { unit: event.target.value as Ingredient['unit'] })}
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                  )}
                </label>
                {weighing && (
                  <button className={`${ui.iconButton} ${ui.iconButtonSmall} ${styles.scale}`} type="button" disabled title="Küchenwaage – folgt bald" aria-label={`${entry.name} mit der Waage wiegen (folgt bald)`}>
                    <IconWeightKg size={18} />
                  </button>
                )}
                <button className={`${ui.iconButton} ${ui.iconButtonSmall}`} type="button" aria-label={`${entry.name} ersetzen`} onClick={() => setPicker(entry.id)}>
                  <Pencil aria-hidden="true" size={16} />
                </button>
                <button className={`${ui.iconButton} ${ui.iconButtonSmall}`} type="button" aria-label={`${entry.name} entfernen`} onClick={() => onChange(ingredients.filter(item => item.id !== entry.id))}>
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={ingredients.length === 0 ? styles.addEmpty : styles.add}>
        <button className={`${ui.secondaryButton} ${ui.small}`} type="button" onClick={() => setPicker('add')}>
          <Plus aria-hidden="true" size={14} /> Zutat hinzufügen
        </button>
        {ingredients.length === 0 && (
          <button className={`${ui.iconButton} ${ui.iconButtonSmall}`} type="button" disabled title="Scannen – folgt bald" aria-label="Zutaten scannen (folgt bald)">
            <ScanLine aria-hidden="true" size={18} />
          </button>
        )}
      </div>

      <IngredientPicker
        open={picker !== null}
        title={picker === 'add' ? 'Zutat hinzufügen' : 'Zutat bearbeiten'}
        foods={foods}
        exclude={ingredients.map(entry => entry.foodId ?? entry.id)}
        onPick={pick}
        onClose={() => setPicker(null)}
      />
    </>
  );
}
