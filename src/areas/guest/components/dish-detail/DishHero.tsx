import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';
import arrowRight from '../../../../../public/images/guest/icons/arrow-right.svg';
import cameraButton from '../../../../../public/images/guest/icons/camera-button.svg';
import styles from './DishHero.module.css';

type DishHeroProps = {
  name: string;
  image: StaticImageData | string;
  backHref: string;
  onCameraClick?: () => void;
};

// Bildbereich oben in der Detailansicht eines Gerichts (Figma „Gastansicht“, Frame „Detailansicht“, Bild 25:516)
export function DishHero({ name, image, backHref, onCameraClick }: DishHeroProps) {
  return (
    <div className={styles.hero}>
      <Link href={backHref} className={styles.back} aria-label="Zurück zur Speisekarte">
        <Image className={styles.backIcon} src={arrowRight} alt="" width={31} height={31} />
      </Link>

      <div className={styles.imageArea}>
        <div className={styles.imageWrapper}>
          <Image className={styles.image} src={image} alt={name} width={1635} height={2000} sizes="310px" priority />
        </div>
        <button type="button" className={styles.camera} onClick={onCameraClick} aria-label="Portion mit Kamera abgleichen">
          <Image src={cameraButton} alt="" width={33} height={33} />
        </button>
      </div>

      <p className={styles.hint}>Portion weicht ab? Eigene Portion mit Kamera abgleichen.</p>
    </div>
  );
}
