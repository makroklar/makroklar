import type { ReactNode } from 'react';
import { NavRail } from './components/navigation/NavRail';
import styles from './DashboardShell.module.css';

// Rahmen aller Dashboard-Seiten: Seitenleiste links (Handy: unten) und Inhalt
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <NavRail />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
