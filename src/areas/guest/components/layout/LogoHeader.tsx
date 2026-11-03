import Image from 'next/image';
import logo from '../../../../../public/images/guest/makroklar-logo.png';
import styles from './LogoHeader.module.css';

// Kopfzeile mit makroklar-Logo, mittig über dem Inhalt (Figma „Gastansicht“, Bild 341:1531)
export function LogoHeader() {
  return (
    <header className={styles.header}>
      <Image src={logo} alt="makroklar." width={188} height={41} priority />
    </header>
  );
}
