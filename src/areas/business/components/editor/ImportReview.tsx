'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import type { Recipe } from '../../data/dashboardModel';
import { IngredientRows } from './IngredientRows';
import type { RestaurantFood } from '../../data/restaurantData';
import ui from '../dashboard/Dashboard.module.css';
import styles from './ImportReview.module.css';

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

function amount(quantity: number | null, unit: string) {
  if (quantity === null) return '';
  if (quantity >= 1000) return `${number.format(quantity / 1000)} ${unit === 'g' ? 'kg' : 'l'}`;
  return `${number.format(quantity)} ${unit}`;
}

// Figma „App / Rezept-Import prüfen“: links das erkannte Dokument, rechts die Zutaten zum Abgleichen
export function ImportReview({ recipe, foods }: { recipe: Recipe; foods: RestaurantFood[] }) {
  const router = useRouter();
  const [ingredients, setIngredients] = useState(recipe.ingredients);
  const rawTotal = recipe.ingredients.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0);

  return (
    <>
      <div className={styles.layout}>
        <section className={`${ui.card} ${styles.document}`} aria-labelledby="document-title">
          <div className={styles.documentHeader}>
            <h2 id="document-title" className={ui.cardTitle}>Originaldokument</h2>
            <span className={styles.badge}>PDF · Seite 1</span>
          </div>
          <div className={styles.sheet}>
            <p className={styles.sheetTitle}>{recipe.name}</p>
            <p className={styles.sheetMeta}>
              {recipe.kind === 'basis' ? `Basisrezept · Ergibt ca. ${amount(rawTotal, 'g')}` : 'Gericht · 1 Portion'}
            </p>
            <div className={styles.recognized}>
              <p>Erkannte Zutaten</p>
              <ul>
                {recipe.ingredients.map(entry => (
                  <li key={entry.id}>{entry.name} {amount(entry.quantity, entry.unit)}</li>
                ))}
              </ul>
            </div>
            <p className={styles.sheetHeading}>Zubereitung</p>
            <p className={styles.sheetText}>{recipe.preparation ?? 'Im Dokument wurde keine Zubereitung erkannt.'}</p>
          </div>
          <p className={styles.legend}>Erkannte Zutaten sind markiert</p>
        </section>

        <section className={ui.card} aria-labelledby="recognized-title">
          <h2 id="recognized-title" className={ui.cardTitle}>Erkannte Zutaten</h2>
          <p className={ui.cardText}>Kategorien und Mengen vor dem Import abgleichen.</p>
          <IngredientRows ingredients={ingredients} onChange={setIngredients} foods={foods} />
        </section>
      </div>

      <div className={styles.footer}>
        <Link className={`${ui.secondaryButton} ${ui.large}`} href="/business/onboarding/menu">Neu hochladen</Link>
        <button
          className={`${ui.primaryButton} ${ui.large}`}
          type="button"
          disabled={ingredients.length === 0}
          onClick={() => router.push('/business')}
        >
          Import bestätigen <ArrowRight aria-hidden="true" size={20} />
        </button>
      </div>
    </>
  );
}
