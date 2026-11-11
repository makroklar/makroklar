import styles from './CarbsBreakdown.module.css';

export type CarbsIngredient = {
  name: string;
  /** Menge der Zutat in der Portion, in Gramm */
  amount: number;
  /** Kohlenhydrate in Gramm */
  carbsPerPortion: number;
  carbsPer100g: number;
};

const gramFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

// Kohlenhydrate je Zutat (Figma „Gastansicht“, Rectangle 5 in „Detailansicht“) – Titel steht in der Kopfzeile der Tabelle
export function CarbsBreakdown({ ingredients }: { ingredients: CarbsIngredient[] }) {
  return (
    <table className={styles.card}>
      <thead>
        <tr>
          <th scope="col" className={styles.title}>
            Kohlenhydrate aufgeschlüsselt
          </th>
          <th scope="col" className={styles.columnHead}>
            Pro Portion
          </th>
          <th scope="col" className={`${styles.columnHead} ${styles.lastColumn}`}>
            Pro 100g
          </th>
        </tr>
      </thead>
      <tbody>
        {ingredients.map(({ name, amount, carbsPerPortion, carbsPer100g }) => (
          <tr key={name}>
            <th scope="row" className={styles.ingredient}>
              {name} ({gramFormat.format(amount)}g)
            </th>
            <td className={styles.value}>
              <span className={styles.chip}>{gramFormat.format(carbsPerPortion)}g KH</span>
            </td>
            <td className={`${styles.value} ${styles.lastColumn}`}>
              <span className={styles.chip}>{gramFormat.format(carbsPer100g)}g KH</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
