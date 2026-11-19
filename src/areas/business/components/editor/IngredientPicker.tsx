'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, ScanLine, Search, X } from 'lucide-react';
import type { Ingredient } from '../../data/dashboardModel';
import type { RestaurantFood } from '../../data/restaurantData';
import { searchFoods } from '../../data/searchFoodsAction';
import { hasCompleteCatalogNutrition } from '../../data/foodSearchModel';
import type { CatalogFood } from '../../types/catalogFood';
import ui from '../dashboard/Dashboard.module.css';
import styles from './IngredientPicker.module.css';

export type PickedIngredient = Omit<Ingredient, 'quantity'>;

interface IngredientPickerProps {
  open: boolean;
  title: string;
  /** Lebensmittel, die das Restaurant schon hinterlegt hat */
  foods: RestaurantFood[];
  /** Schon im Rezept verwendete Lebensmittel (jedes nur einmal pro Rezept) */
  exclude: string[];
  onPick: (ingredient: PickedIngredient) => void;
  onClose: () => void;
}

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; foods: CatalogFood[]; hasMore: boolean }
  | { status: 'error'; message: string };

function unitFor(basis: RestaurantFood['basis']): Ingredient['unit'] {
  return basis === '100ml' ? 'ml' : 'g';
}

function fromRestaurant(food: RestaurantFood): PickedIngredient {
  return { id: food.id, foodId: food.id, name: food.name, supplier: food.supplier, unit: unitFor(food.basis), basis: food.basis };
}

function fromCatalog(food: CatalogFood): PickedIngredient {
  return {
    id: food.id, foodId: food.id, name: food.name, unit: unitFor(food.basis), basis: food.basis, catalogFood: food,
    supplier: food.source.kind === 'bls' ? 'Bundeslebensmittelschlüssel (BLS)' : `Open Food Facts${food.detail ? ` · ${food.detail}` : ''}`,
  };
}

// Overlay „Zutat bearbeiten“ (Figma): eigene Lebensmittel und Suche in BLS / Open Food Facts
export function IngredientPicker({ open, title, foods, exclude, onPick, onClose }: IngredientPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'idle' });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery('');
      setSearch({ status: 'idle' });
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const needle = query.trim();
  useEffect(() => {
    if (needle.length < 2) { setSearch({ status: 'idle' }); return; }
    let cancelled = false;
    setSearch({ status: 'loading' });
    const timer = setTimeout(async () => {
      try {
        const result = await searchFoods(needle);
        if (cancelled) return;
        setSearch(result.status === 'error'
          ? result
          : { status: 'done', foods: result.foods.filter(hasCompleteCatalogNutrition), hasMore: result.hasMore });
      } catch {
        if (!cancelled) setSearch({ status: 'error', message: 'Die Suche ist gerade nicht verfügbar.' });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [needle]);

  const lower = needle.toLocaleLowerCase('de-DE');
  const used = new Set(exclude);
  const own = foods.filter(food => !used.has(food.id)
    && (lower === '' || food.name.toLocaleLowerCase('de-DE').includes(lower)));
  const ownIds = new Set(foods.map(food => food.id));
  const found = search.status === 'done'
    ? search.foods.filter(food => !ownIds.has(food.id) && !used.has(food.id)) : [];

  function renderList(entries: PickedIngredient[]) {
    return (
      <ul className={styles.list}>
        {entries.map(entry => (
          <li key={entry.id} className={styles.item}>
            <span>
              <strong>{entry.name}</strong>
              <small>{entry.supplier}</small>
            </span>
            <button className={styles.pick} type="button" aria-label={`${entry.name} übernehmen`} onClick={() => onPick(entry)}>
              <Plus aria-hidden="true" size={22} strokeWidth={2.5} />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="ingredient-picker-title"
      onClose={onClose}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id="ingredient-picker-title">{title}</h2>
          <button className={styles.close} type="button" aria-label="Schließen" onClick={onClose}>
            <X aria-hidden="true" size={28} />
          </button>
        </header>

        <div className={styles.searchRow}>
          <label className={styles.search}>
            <Search aria-hidden="true" size={20} />
            <span className={ui.visuallyHidden}>Zutat suchen</span>
            <input type="search" placeholder="Zutat oder Barcode suchen..." value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          <button className={`${ui.iconButton} ${ui.iconButtonFilled} ${styles.scan}`} type="button" disabled title="Scannen – folgt bald" aria-label="Zutat scannen (folgt bald)">
            <ScanLine aria-hidden="true" size={22} />
          </button>
        </div>

        <section aria-label="Deine Lebensmittel">
          <h3 className={styles.groupTitle}>Deine Lebensmittel</h3>
          {own.length === 0
            ? <p className={styles.none}>{foods.length === 0 ? 'Du hast noch keine Lebensmittel hinterlegt. Suche oben in BLS und Open Food Facts.' : 'Keine passenden Lebensmittel.'}</p>
            : renderList(own.map(fromRestaurant))}
        </section>

        {needle.length >= 2 && (
          <section aria-label="Suchergebnisse" aria-busy={search.status === 'loading'}>
            <h3 className={styles.groupTitle}>Aus BLS und Open Food Facts</h3>
            {search.status === 'loading' && <p className={styles.none}>Suche läuft…</p>}
            {search.status === 'error' && <p className={styles.none} role="alert">{search.message}</p>}
            {search.status === 'done' && (found.length === 0
              ? <p className={styles.none}>Nichts gefunden.</p>
              : renderList(found.map(fromCatalog)))}
            {search.status === 'done' && search.hasMore && <p className={styles.none}>Weitere Treffer – bitte genauer suchen.</p>}
          </section>
        )}
      </div>
    </dialog>
  );
}
