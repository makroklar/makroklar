'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './MenuImportSkip.module.css';

export function MenuImportSkip() {
  const pathname = usePathname();
  if (
    pathname !== '/business/onboarding/menu' &&
    pathname !== '/business/onboarding/menu/pos'
  ) return null;

  return (
    <Link className={styles.link} href="/business/onboarding/purchases">
      Überspringen – später einrichten
    </Link>
  );
}
