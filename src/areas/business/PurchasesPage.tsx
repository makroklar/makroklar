'use client';

import { ArrowIcon } from './components/ui/ArrowIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useBusinessDraft } from './state/BusinessDraftContext';
import styles from './PurchasesPage.module.css';
import { FoodSearch } from './components/onboarding/FoodSearch';
import { hasCompleteCatalogNutrition } from './data/foodSearchModel';

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 10 });

export function PurchasesPage() {
  const { manualFoods, removeManualFood, catalogFoods, removeCatalogFood, foodUsages, canRemoveFoods,
    setSelectedDishId, setSelectedBasisId } = useBusinessDraft();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const foods = [
    ...manualFoods.map(food => ({ ...food, label: 'manuell', complete: true, remove: removeManualFood })),
    ...catalogFoods.map(food => ({ ...food, label: food.source.kind === 'bls' ? 'BLS' : 'Open Food Facts', complete: hasCompleteCatalogNutrition(food), remove: removeCatalogFood })),
  ];
  const format = (value: number | null) => value === null ? '–' : number.format(value);
  return (
    <section aria-labelledby="food-sources-title">
      <header className={styles.intro}>
        <h1 className={styles.title} id="food-sources-title">
          Füge deine Lebensmittel hinzu.
        </h1>
        <p className={styles.description} id="food-sources-help">
          Füge Lebensmittel hinzu, die du für deine Gerichte verwendest.
          Dieser Schritt ist optional. Du kannst deine Liste später im Dashboard ergänzen.
        </p>
      </header>
      <FoodSearch />
      {!canRemoveFoods && <div className={styles.note} role="status">
        <p>Solange die gespeicherten Rezepte nicht vollständig geladen sind, können Lebensmittel nicht entfernt werden.</p>
        <button className={styles.textButton} type="button" disabled={refreshing}
          onClick={() => startRefresh(() => router.refresh())}>
          {refreshing ? 'Wird geladen …' : 'Gespeicherte Rezepte erneut laden'}
        </button>
      </div>}
      <div className={styles.tableWrapper} role="region" aria-label="Deine Lebensmittel" tabIndex={0}>
        <table className={styles.table}>
          <caption>Deine Lebensmittel ({foods.length})</caption>
          <thead>
            <tr>
              <th scope="col">Lebensmittel</th><th scope="col">Bezug</th>
              <th scope="col">Energie (kcal)</th><th scope="col">Eiweiß (g)</th>
              <th scope="col">Fett (g)</th><th scope="col">Kohlenhydrate (g)</th><th scope="col">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {foods.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>Noch keine Lebensmittel hinzugefügt.</td></tr>
            ) : foods.map(food => {
              const usages = foodUsages.get(food.id) ?? [];
              const usageId = `food-usage-${food.id}`;
              return (
              <tr key={food.id}>
                <th scope="row" className={styles.foodName}>
                  {food.name} <small className={styles.manualLabel}>{food.label}</small>
                  {!food.complete && <span className={styles.preparation}>Nährwerte unvollständig</span>}
                  {food.preparation && <span className={styles.preparation}>{food.preparation === 'as_sold' ? 'Wie verkauft' : 'Zubereitet'}</span>}
                </th>
                <td>{food.basis === '100g' ? '100 g' : food.basis === '100ml' ? '100 ml' : '–'}</td>
                <td>{format(food.energyKcal)}</td><td>{format(food.proteinG)}</td>
                <td>{format(food.fatG)}</td><td>{format(food.carbohydrateG)}</td>
                <td className={styles.foodAction}>
                  <button className={styles.textButton} type="button" disabled={!canRemoveFoods || usages.length > 0}
                    onClick={() => food.remove(food.id)} aria-label={`${food.name} entfernen`}
                    aria-describedby={usages.length > 0 ? usageId : undefined}>Entfernen</button>
                  {usages.length > 0 && <details className={styles.usage} id={usageId}>
                    <summary>Verwendet in {usages.length} {usages.length === 1 ? 'Rezept' : 'Rezepten'}</summary>
                    <p>Entferne zuerst die Zutat aus diesen Rezepten:</p>
                    <ul>
                      {usages.map(usage => <li key={`${usage.kind}:${usage.id}`}>
                        <Link className={styles.manualLink}
                          href={usage.kind === 'dish'
                            ? `/business/onboarding/dishes#dish-button-${encodeURIComponent(usage.id)}`
                            : `/business/onboarding/bases#basis-button-${encodeURIComponent(usage.id)}`}
                          onClick={() => usage.kind === 'dish' ? setSelectedDishId(usage.id) : setSelectedBasisId(usage.id)}>
                          {usage.kind === 'dish' ? 'Gericht' : 'Basisrezept'}: {usage.name}
                        </Link>
                      </li>)}
                    </ul>
                  </details>}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.manualAction}>
        <Link className={styles.manualLink} href="/business/onboarding/purchases/manual">Regional / Manuell hinzufügen</Link>
      </p>
      <p className={styles.note}>Neue Änderungen bleiben bis „Einrichtung abschließen“ vorläufig. Bereits gespeicherte Lebensmittel werden beim nächsten Besuch wieder geladen.</p>
      <div className={styles.actions}>
        <Link
          className={styles.continueButton}
          href="/business/onboarding/bases"
        >
          <span>Weiter</span>
          <ArrowIcon tone="inherit" />
        </Link>
      </div>
    </section>
  );
}
