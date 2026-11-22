'use client';

import { useState } from 'react';
import { IconClock } from '@/shared/components/icons/IconClock';
import { InjectionHintDialog } from './InjectionHintDialog';
import styles from './DishInfo.module.css';

type DishInfoProps = {
  name: string;
  /** Preis in Euro, z. B. 13.9 */
  price: number;
  /** Aktuelle Zubereitungsdauer, z. B. „ca. 15-25min“ */
  duration: string;
  kcal: number;
  /** Nährwerte in Gramm */
  fat: number;
  protein: number;
  carbs: number;
  /** Fett-Protein-Einheiten */
  fpe: number;
  /** Zeitraum, in dem der BZ durch Fett & Protein noch ansteigen kann, z. B. „6-8“ */
  fpeHours: string;
};

// Wie in der DishCard ohne Leerzeichen vor dem Euro-Zeichen: „13,90€“
const formatPrice = (price: number) => `${price.toFixed(2).replace('.', ',')}€`;
const fpeFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

// Infoblock der Detailansicht (Figma „Gastansicht“, Rectangle 98 in „Detailansicht“):
// Name, Preis, Dauer und Nährwerte der abgebildeten Portion – das „i“ öffnet den Hinweis fürs Spritzen
export function DishInfo({ name, price, duration, kcal, fat, protein, carbs, fpe, fpeHours }: DishInfoProps) {
  const [hintOpen, setHintOpen] = useState(false);

  const nutrients = [
    { value: kcal, unit: '', label: 'Kcal' },
    { value: fat, unit: 'g', label: 'Fett' },
    { value: protein, unit: 'g', label: 'Protein' },
    { value: carbs, unit: 'g', label: 'KH', highlight: true },
  ];

  return (
    <section className={styles.info} aria-labelledby="dish-info-name">
      <h1 id="dish-info-name" className={styles.name}>
        {name}
      </h1>
      <p className={styles.price}>{formatPrice(price)}</p>

      <p className={styles.duration}>
        <span className={styles.durationIcon}>
          <IconClock size={16} />
        </span>
        <span className={styles.durationLabel}>
          Aktuelle Dauer: <strong>{duration}</strong>
        </span>
      </p>

      <p className={styles.portionLabel}>abgebildete Portion entspricht:</p>
      <ul className={styles.nutrients} aria-label="Nährwerte">
        {nutrients.map(({ value, unit, label, highlight }) => (
          <li key={label} className={`${styles.tile} ${highlight ? styles.tileHighlight : ''}`}>
            <span className={styles.tileValue}>
              {value}
              {unit}
            </span>
            <span className={styles.tileLabel}>{label}</span>
          </li>
        ))}
        {/* FPE-Kachel und „i“ in einem: die ganze Kachel öffnet den Hinweis fürs Spritzen */}
        <li>
          <button
            type="button"
            className={`${styles.tile} ${styles.tileHighlight} ${styles.fpeButton}`}
            onClick={() => setHintOpen(true)}
            aria-label={`${fpeFormat.format(fpe)} FPE – Hinweis fürs Spritzen anzeigen`}
          >
            <span className={styles.tileValue}>{fpeFormat.format(fpe)}</span>
            <span className={styles.tileLabel}>FPE</span>
            <span className={styles.infoBadge} aria-hidden="true">
              i
            </span>
          </button>
        </li>
      </ul>

      <p className={styles.notice}>
        Alle Angaben stammen vom Restaurant und sind Richtwerte zur Orientierung. Portionsgrößen und Zubereitungszeiten können variieren.
      </p>

      <InjectionHintDialog open={hintOpen} fpe={fpe} hours={fpeHours} onConfirm={() => setHintOpen(false)} />
    </section>
  );
}
