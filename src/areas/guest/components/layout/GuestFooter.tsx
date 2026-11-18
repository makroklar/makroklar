import Image from 'next/image';
import Link from 'next/link';
import logo from '../../../../../public/images/guest/makroklar-logo.png';
import { footerNavigation } from '@/areas/landing/content/navigation';
import styles from './GuestFooter.module.css';

// Links kommen aus der Footer-Navigation der Landingpage, damit beide Footer gleich bleiben.
// Für Gäste nur die Seiten, die sie betreffen – Produkt-, Preis- und Anleitungsseiten richten sich an die Gastronomie
const guestHrefs = ['/hilfe', '/kontakt', '/ueber-uns', '/datenschutz', '/impressum'];
const links = footerNavigation.flatMap((group) => group.links).filter((link) => guestHrefs.includes(link.href));

// Fußzeile der Gastansicht, angelehnt an den Footer der Landingpage, aber kompakt für Handys
export function GuestFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href="/" aria-label="makroklar – zur Startseite" className={styles.logo}>
            <Image src={logo} alt="" width={132} height={29} />
          </Link>
          <p className={styles.tagline}>Nährwerte verständlich. Entscheidungen sicherer.</p>
        </div>

        <nav aria-label="Rechtliches und Hilfe">
          <ul className={styles.links}>
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.link}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className={styles.copyright}>© {new Date().getFullYear()} makroklar.</p>
      </div>
    </footer>
  );
}
