'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowIcon } from './components/ui/ArrowIcon';
import { useBusinessDraft } from './state/BusinessDraftContext';
import { NewDishForm } from './components/onboarding/NewDishForm';
import { RecipeEditor } from './components/onboarding/RecipeEditor';
import { FinishOnboarding } from './components/onboarding/FinishOnboarding';
import styles from './DishesSetupPage.module.css';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function DishesSetupPage() {
  const { importedItems, storageError, customDishes, selectedDishId: selectedId, setSelectedDishId: setSelectedId } = useBusinessDraft();
  const [adding, setAdding] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  const items = [
    ...importedItems.map(item => ({ id: `${item.source}-${item.sourceId}`, name: item.name,
      group: item.accountingGroup?.name || 'Keine Gruppe angegeben', sku: item.sku,
      price: item.selectedPriceIndex === null ? undefined : item.prices[item.selectedPriceIndex] })),
    ...customDishes.map(item => ({ id: `manual-${item.id}`, name: item.name, group: 'Manuell hinzugefügt', sku: '',
      price: item.price === null ? undefined : { name: 'Standard', amount: item.price } })),
  ];

  return (
    <section aria-labelledby="dishes-setup-title">
      <header className={styles.intro}>
        <h1 className={styles.title} id="dishes-setup-title">Vervollständige deine Gerichte.</h1>
        <p className={styles.description}>
          Wähle ein Gericht aus oder füge ein neues hinzu.
          Ordne Lebensmittel und Mengen zu, um die Nährwerte pro Portion zu berechnen.
        </p>
      </header>

      {adding ? <NewDishForm onClose={() => setAdding(false)} /> : (
        <button className={styles.newDishButton} type="button" onClick={() => setAdding(true)}>Neues Gericht hinzufügen</button>
      )}

      {storageError ? (
        <div className={styles.message}>
          <p role="alert">{storageError}</p>
          <button className={styles.textButton} type="button" disabled={refreshing}
            onClick={() => startRefresh(() => router.refresh())}>
            {refreshing ? 'Wird geladen …' : 'Erneut laden'}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.message}>
          <p>Noch keine Gerichte vorhanden. Füge ein Gericht hinzu oder importiere deine Speisekarte.</p>
          <Link className={styles.link} href="/business/onboarding/menu">Zur Speisekarte</Link>
        </div>
      ) : (
        <>
          <h2 className={styles.listTitle} id="imported-dishes-title">Deine Gerichte ({items.length})</h2>
          <div className={styles.listRegion} role="region" aria-labelledby="imported-dishes-title" tabIndex={0}>
            <ul className={styles.list}>
              {items.map(item => {
                const { id, price, group } = item;
                const selected = selectedId === id;
                return (
                  <li className={styles.dish} key={id} data-open={selected}>
                    <button className={styles.dishButton} type="button" id={`dish-button-${id}`}
                      aria-expanded={selected} aria-controls={`dish-details-${id}`}
                      onClick={() => setSelectedId(selected ? null : id)}>
                      <span className={styles.dishSummary}>
                        <span className={styles.dishName}>{item.name}</span>
                        <span className={styles.group}>{group}</span>
                      </span>
                      <span className={styles.selection}>
                        <span>{selected ? 'Details schließen' : 'Details ansehen'}</span>
                        <span className={styles.arrow}><ArrowIcon tone="inherit" /></span>
                      </span>
                    </button>
                    <div className={styles.details} id={`dish-details-${id}`} hidden={!selected}
                      role="region" aria-labelledby={`dish-button-${id}`}>
                      <dl className={styles.metadata}>
                        <div><dt>Name</dt><dd>{item.name}</dd></div>
                        <div><dt>Gruppe</dt><dd>{group}</dd></div>
                        <div><dt>Artikelnummer (SKU)</dt><dd>{item.sku || 'Nicht angegeben'}</dd></div>
                        <div>
                          <dt>Ausgewählter Verkaufspreis</dt>
                          <dd>{price ? <>{euro.format(price.amount)} <span className={styles.priceName}>({price.name})</span></> : 'Kein Preis ausgewählt'}</dd>
                        </div>
                      </dl>
                      {selected && <RecipeEditor dishId={id} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
      <FinishOnboarding />
    </section>
  );
}
