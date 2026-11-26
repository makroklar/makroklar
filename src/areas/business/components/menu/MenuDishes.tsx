'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Pencil } from 'lucide-react';
import { editHref, type Recipe } from '../../data/dashboardModel';
import ui from '../dashboard/Dashboard.module.css';
import styles from './MenuDishes.module.css';


const price = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const amount = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export function MenuDishes({ dishes }: { dishes: Recipe[] }) {
  // Kategorien kommen aus den Warengruppen des Kassensystems
  const filters = ['Alle', ...new Set(dishes.map(dish => dish.category))];
  const [filter, setFilter] = useState('Alle');
  const visible = filter === 'Alle' ? dishes : dishes.filter(dish => dish.category === filter);

  if (dishes.length === 0) {
    return (
      <div className={styles.empty}>
        <h2>Deine Live-Speisekarte ist noch leer.</h2>
        <p>Überprüfe die fehlenden Angaben in deiner Rezept-Bibliothek und schalte deine Gerichte für die Gäste frei!</p>
        <Link className={`${ui.primaryButton} ${ui.large}`} href="/business/rezepte">
          Zur Rezept-Bibliothek <ArrowRight aria-hidden="true" size={20} />
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={ui.chips} role="group" aria-label="Nach Kategorie filtern">
        {filters.map(entry => (
          <button key={entry} className={ui.chip} type="button" aria-pressed={filter === entry} onClick={() => setFilter(entry)}>
            {entry}.
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className={styles.none}>In dieser Kategorie ist noch kein Gericht auf der Karte.</p>
      ) : (
        <ul className={styles.list}>
          {visible.map(dish => (
            <li key={dish.slug} className={styles.dish}>
              <span className={styles.photo} aria-hidden="true">{dish.name.slice(0, 2).toUpperCase()}</span>
              <div className={styles.text}>
                <p className={styles.nameRow}>
                  <strong>{dish.name}</strong>
                  {dish.price !== undefined && <span>{price.format(dish.price)}</span>}
                </p>
                {dish.description && <p className={styles.description}>{dish.description}</p>}
              </div>
              {dish.nutrition && (
                <ul className={styles.macros} aria-label="Nährwerte pro Portion">
                  <li>{amount.format(dish.nutrition.energyKcal)} Kcal</li>
                  <li>{amount.format(dish.nutrition.fatG)}g Fett</li>
                  <li>{amount.format(dish.nutrition.proteinG)}g P</li>
                  <li className={styles.carbs}>{amount.format(dish.nutrition.carbohydrateG)}g KH</li>
                </ul>
              )}
              <Link className={`${ui.iconButton} ${ui.iconButtonSmall}`} href={editHref(dish)} aria-label={`${dish.name} bearbeiten`}>
                <Pencil aria-hidden="true" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
