import Image, { type StaticImageData } from 'next/image';
import styles from './DishHero.module.css';

type DishHeroProps = {
  name: string;
  image: StaticImageData | string;
};

// Bildbereich oben in der Detailansicht eines Gerichts (Figma „Gastansicht“, Frame „Detailansicht“, Bild 25:516).
// Der Zurück-Pfeil sitzt im LogoHeader darüber
export function DishHero({ name, image }: DishHeroProps) {
  return (
    <div className={styles.hero}>
      <div className={styles.imageArea}>
        <div className={styles.imageWrapper}>
          <Image className={styles.image} src={image} alt={name} width={1635} height={2000} sizes="310px" priority />
        </div>
      </div>

      <p className={styles.hint}>Die abgebildete Portion dient als Vergleichswert für die Nährwerte.</p>
    </div>
  );
}
