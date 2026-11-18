'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import closeIcon from '../../../../../public/images/guest/icons/close.svg';
import { getPreviousGuestPath } from '../../navigation/guestHistory';
import styles from './LogoHeader.module.css';

type LogoHeaderProps = {
  // Mit Ziel erscheint rechts ein Schließen-Kreuz (z. B. in der Detailansicht zurück zur Speisekarte)
  closeHref?: string;
  closeLabel?: string;
};

// Kopfzeile wie der Header der Landingpage: Logo links, Aktion rechts. Beim Scrollen wird sie
// niedriger, halbtransparent mit Weichzeichner, Linie und Schatten
export function LogoHeader({ closeHref, closeLabel = 'Schließen und zurück zur Speisekarte' }: LogoHeaderProps) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 12);
    updateScrolled();
    window.addEventListener('scroll', updateScrolled, { passive: true });
    return () => window.removeEventListener('scroll', updateScrolled);
  }, []);

  // Kam der Gast von dort, geht es im Verlauf zurück – die Scrollposition bleibt erhalten.
  // Sonst (direkt aufgerufen) führt der Link ganz normal zum Ziel
  const handleClose = (event: MouseEvent<HTMLAnchorElement>) => {
    if (getPreviousGuestPath() !== closeHref) return;
    event.preventDefault();
    router.back();
  };

  // Fixed statt sticky: Das Schrumpfen verschiebt so nicht den Inhalt.
  // Der Platzhalter hält die Höhe des großen Headers frei
  return (
    <>
      <div aria-hidden className={styles.spacer} />
      <header className={styles.header} data-scrolled={scrolled || undefined}>
        <div className={styles.inner}>
          <Link href="/" aria-label="makroklar – zur Startseite" className={styles.logo}>
            <Image src="/images/logo.png" alt="" width={188} height={33} priority />
          </Link>
          {closeHref && (
            <Link href={closeHref} onClick={handleClose} className={styles.close} aria-label={closeLabel}>
              <Image src={closeIcon} alt="" width={31} height={31} />
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
