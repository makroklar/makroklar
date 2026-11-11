'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { searchFoods } from '../../data/searchFoodsAction';
import { hasCompleteCatalogNutrition } from '../../data/foodSearchModel';
import { useBusinessDraft } from '../../state/BusinessDraftContext';
import { createFoodSearch, type FoodSearchState } from '../../state/foodSearch';
import styles from './FoodSearch.module.css';

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const format = (value: number | null) => value === null ? '–' : number.format(value);

export function FoodSearch() {
  const [query, setQuery] = useState('');
  const [{ searched, result, pending }, setSearchState] = useState<FoodSearchState>({ searched: '', result: null, pending: false });
  const [announcement, setAnnouncement] = useState('');
  const search = useRef<ReturnType<typeof createFoodSearch> | null>(null);
  const composing = useRef(false);
  const { catalogFoods, addCatalogFood } = useBusinessDraft();

  useEffect(() => {
    const current = createFoodSearch(searchFoods, setSearchState);
    search.current = current;
    return () => { current.dispose(); search.current = null; };
  }, []);

  function changeQuery(value: string) {
    setQuery(value);
    setAnnouncement('');
    search.current?.change(value, composing.current);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current) return;
    setAnnouncement('');
    void search.current?.submit(query);
  }

  return (
    <section className={styles.search} aria-label="Lebensmittel suchen">
      <form onSubmit={submit}>
        <label className={styles.label} htmlFor="food-query">Name oder Barcode</label>
        <div className={styles.searchRow}>
          <input id="food-query" type="search" value={query} onChange={event => changeQuery(event.target.value)}
            onCompositionStart={() => { composing.current = true; search.current?.change(query, true); }}
            onCompositionEnd={event => { composing.current = false; changeQuery(event.currentTarget.value); }}
            placeholder="Name oder Barcode eingeben" required minLength={2} maxLength={100}
            aria-describedby="food-search-help" className={styles.input} />
          <button className={styles.button} type="submit" disabled={pending}>{pending ? 'Suche läuft …' : 'Suchen'}</button>
        </div>
        <p id="food-search-help" className={styles.help}>Name: BLS-Ergebnisse erscheinen ab drei Buchstaben nach einer kurzen Schreibpause. Barcode: Suche in Open Food Facts mit „Suchen“ oder Enter.</p>
      </form>
      <p className={styles.status} role="status">
        {pending ? 'Lebensmittel werden gesucht …' : announcement || (result?.status === 'success' ? `${result.foods.length} Treffer für „${searched}“.${result.hasMore ? ' Bitte grenze deine Suche weiter ein.' : ''}` : '')}
      </p>
      {result?.status === 'error' && <p role="alert" className={styles.error}>{result.message}</p>}
      {result?.status === 'success' && result.foods.length === 0 && (
        <p className={styles.help}>Kein Lebensmittel gefunden. Versuche einen genaueren Namen, den Produkt-Barcode oder füge es unten manuell hinzu.</p>
      )}
      {result?.status === 'success' && result.foods.length > 0 && (
        <ul className={styles.results} aria-label="Suchergebnisse">
          {result.foods.map(food => {
            const added = catalogFoods.some(item => item.id === food.id);
            const complete = hasCompleteCatalogNutrition(food);
            return (
              <li className={styles.result} key={food.id}>
                <div className={styles.resultHeader}>
                  <div><h2 className={styles.name}>{food.name}</h2><p className={styles.help}>{food.detail}</p></div>
                  <button className={styles.button} type="button" disabled={added}
                    aria-label={added ? `${food.name} bereits hinzugefügt` : `${food.name} hinzufügen`}
                    onClick={() => { addCatalogFood(food); setAnnouncement(`${food.name} wurde zur Liste hinzugefügt.`); }}>
                    {added ? 'Hinzugefügt' : 'Hinzufügen'}
                  </button>
                </div>
                <p className={styles.help}>
                  {food.basis === '100g' ? 'Je 100 g' : food.basis === '100ml' ? 'Je 100 ml' : 'Bezugsmenge fehlt'}
                  {food.preparation ? ` · ${food.preparation === 'as_sold' ? 'Wie verkauft' : 'Zubereitet'}` : ''}
                </p>
                <dl className={styles.nutrients}>
                  <div><dt>Energie</dt><dd>{format(food.energyKcal)} kcal</dd></div>
                  <div><dt>Eiweiß</dt><dd>{format(food.proteinG)} g</dd></div>
                  <div><dt>Fett</dt><dd>{format(food.fatG)} g</dd></div>
                  <div><dt>Kohlenhydrate</dt><dd>{format(food.carbohydrateG)} g</dd></div>
                </dl>
                {food.source.kind === 'off' && <p className={styles.help}>Quelle: <a href={`https://world.openfoodfacts.org/product/${food.source.barcode}`} target="_blank" rel="noopener noreferrer">Open Food Facts</a> · {food.source.barcode}. Bitte mit der Verpackung vergleichen.</p>}
                {!complete && <p className={styles.help}><strong>Nährwerte unvollständig.</strong> Du kannst das Lebensmittel trotzdem hinzufügen. Für eine vollständige Berechnung deiner Gerichte müssen die fehlenden Angaben noch ergänzt werden. Fehlende Werte werden nicht als 0 übernommen.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
