import type { ReactNode } from 'react';
import styles from './BusinessLayout.module.css';

// Layout der Restaurantansicht (Figma-Datei 1) – Navigation usw. kommt später
export function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.layout}>
      {children}
    </div>
  );
}
