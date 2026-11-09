import styles from './DishIngredients.module.css';

// Zutatenliste der Detailansicht (Figma „Gastansicht“, Text 263:144)
export function DishIngredients({ ingredients }: { ingredients: string[] }) {
  return (
    <section className={styles.ingredients} aria-labelledby="dish-ingredients-title">
      <h2 id="dish-ingredients-title" className={styles.title}>
        Zutaten:
      </h2>
      <p className={styles.list}>{ingredients.join(', ')}</p>
    </section>
  );
}
