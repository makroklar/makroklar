'use client';

import { useBusinessDraft } from '../../state/BusinessDraftContext';
import { formatNutritionValue, getSavedDishNutrition } from '../../data/savedDishNutrition';
import styles from './SavedDishNutrition.module.css';

export function SavedDishNutrition({ dishId }: { dishId: string }) {
  const { savedSummary, onboardingVersion, hasUnsavedChanges, onboardingError, storageError } = useBusinessDraft();
  const result = getSavedDishNutrition({ summary: savedSummary, dishId, version: onboardingVersion,
    hasUnsavedChanges, readError: onboardingError ?? storageError });
  return (
    <section className={styles.section} aria-labelledby={`nutrition-${dishId}`}>
      <h3 className={styles.title} id={`nutrition-${dishId}`}>Nährwerte pro Portion</h3>
      <p className={styles.note} role="status">{result.message}</p>
      {result.status === 'saved' && <dl className={styles.metrics}>
        {result.rows.map(row => <div key={row.code}>
          <dt>{row.label}</dt>
          <dd>{formatNutritionValue(row.value)}{row.value !== null && ` ${row.unit}`}</dd>
        </div>)}
      </dl>}
    </section>
  );
}
