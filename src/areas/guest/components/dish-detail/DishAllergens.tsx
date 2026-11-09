import styles from './DishAllergens.module.css';

// Enthaltene Allergene in der Detailansicht (Figma „Gastansicht“, Text 263:142)
export function DishAllergens({ allergens }: { allergens: string[] }) {
  return (
    <section className={styles.allergens} aria-labelledby="dish-allergens-title">
      <h2 id="dish-allergens-title" className={styles.title}>
        Enthält:
      </h2>
      <p className={styles.list}>{allergens.join(', ')}</p>
    </section>
  );
}
