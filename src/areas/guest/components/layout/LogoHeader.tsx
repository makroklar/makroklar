import Image from 'next/image';
import Link from 'next/link';
import arrowRight from '../../../../../public/images/guest/icons/arrow-right.svg';
import logo from '../../../../../public/images/guest/makroklar-logo.png';
import styles from './LogoHeader.module.css';

type LogoHeaderProps = {
  // Mit Ziel erscheint links ein Zurück-Pfeil (z. B. in der Detailansicht zurück zur Speisekarte)
  backHref?: string;
  backLabel?: string;
};

// Kopfzeile mit makroklar-Logo, mittig über dem Inhalt (Figma „Gastansicht“, Bild 341:1531)
export function LogoHeader({ backHref, backLabel = 'Zurück zur Speisekarte' }: LogoHeaderProps) {
  return (
    <header className={styles.header}>
      {backHref && (
        <Link href={backHref} className={styles.back} aria-label={backLabel}>
          <Image className={styles.backIcon} src={arrowRight} alt="" width={31} height={31} />
        </Link>
      )}
      <Image src={logo} alt="makroklar." width={188} height={41} priority />
    </header>
  );
}
