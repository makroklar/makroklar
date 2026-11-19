'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, LayoutGrid, Menu, Plus, ReceiptText, UserRound } from 'lucide-react';
import styles from './NavRail.module.css';

const items = [
  { href: '/business', label: 'Dashboard', icon: LayoutGrid, match: ['/business', '/business/aufgaben'], mobileOrder: 1 },
  { href: '/business/menu', label: 'Speisekarte', icon: ReceiptText, match: ['/business/menu'], mobileOrder: 2 },
  { href: '/business/rezepte', label: 'Rezeptbibliothek', icon: BookOpen, match: ['/business/rezepte'], mobileOrder: 4 },
];
const addMatch = ['/business/hinzufuegen', '/business/neu'];
const profileMatch = ['/business/profil'];

function isActive(pathname: string, match: string[]) {
  return match.some(prefix => prefix === '/business'
    ? pathname === '/business'
    : pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Seitenleiste der Inhaber-Ansicht. Ab 768 px links als schmale Leiste (per Menü-Button
// mit Beschriftung ausklappbar), darunter als Tab-Leiste am unteren Rand.
export function NavRail() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const addActive = isActive(pathname, addMatch);
  const profileActive = isActive(pathname, profileMatch);

  return (
    <nav className={styles.rail} data-expanded={expanded} aria-label="Hauptnavigation">
      <button
        className={`${styles.item} ${styles.toggle}`}
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? 'Navigation einklappen' : 'Navigation ausklappen'}
        onClick={() => setExpanded(value => !value)}
      >
        <Menu aria-hidden="true" size={20} strokeWidth={1.75} />
      </button>

      <Link
        className={styles.add}
        href="/business/hinzufuegen"
        data-mobile-order={3}
        aria-current={addActive ? 'page' : undefined}
        aria-label="Hinzufügen"
      >
        <span className={styles.addCircle}>
          <Plus aria-hidden="true" size={24} strokeWidth={2} />
        </span>
        <span className={styles.label}>Hinzufügen</span>
      </Link>

      {items.map(({ href, label, icon: Icon, match, mobileOrder }) => {
        const active = isActive(pathname, match);
        return (
          <Link
            key={href}
            className={styles.item}
            href={href}
            data-mobile-order={mobileOrder}
            aria-current={active ? 'page' : undefined}
            aria-label={expanded ? undefined : label}
          >
            <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}

      <Link
        className={`${styles.item} ${styles.profile}`}
        href="/business/profil"
        data-mobile-order={5}
        aria-current={profileActive ? 'page' : undefined}
        aria-label={expanded ? undefined : 'Profil & Einstellungen'}
      >
        <UserRound aria-hidden="true" size={20} strokeWidth={1.75} />
        <span className={styles.label}>Profil</span>
      </Link>
    </nav>
  );
}
