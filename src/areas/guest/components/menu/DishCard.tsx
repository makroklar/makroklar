import Image, { type StaticImageData } from 'next/image';
import styles from './DishCard.module.css';

export type DishCardProps = {
  name: string;
  description: string;
  /** Preis in Euro, z. B. 13.9 */
  price: number;
  image: StaticImageData | string;
  kcal: number;
  /** Nährwerte in Gramm */
  fat: number;
  protein: number;
  carbs: number;
};

// Wie im Design ohne Leerzeichen vor dem Euro-Zeichen: „13,90€“
const formatPrice = (price: number) => `${price.toFixed(2).replace('.', ',')}€`;

// Gericht in der Speisekarte (Figma „Gastansicht“, Component 2) – Bild ragt links über die Karte
export function DishCard({ name, description, price, image, kcal, fat, protein, carbs }: DishCardProps) {
  return (
    <article className={styles.dishCard}>
      <div className={styles.imageWrapper}>
        <Image className={styles.image} src={image} alt={name} width={1635} height={2000} sizes="120px" />
      </div>

      <div className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.name}>{name}</h3>
          <span className={styles.price}>{formatPrice(price)}</span>
        </div>
        <p className={styles.description}>{description}</p>

        <ul className={styles.nutrients}>
          <li className={styles.chip}>{kcal} Kcal</li>
          <li className={styles.chip}>{fat}g Fett</li>
          <li className={styles.chip}>{protein}g Protein</li>
          <li className={`${styles.chip} ${styles.chipCarbs}`}>{carbs}g KH</li>
        </ul>
      </div>
    </article>
  );
}
