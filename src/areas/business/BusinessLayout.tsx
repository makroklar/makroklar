import type { ReactNode } from 'react';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import { BusinessDraftProvider } from './state/BusinessDraftContext';
import styles from './BusinessLayout.module.css';

// Layout der Restaurantansicht (Figma-Datei 1) – Navigation usw. kommt später
export function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <BusinessDraftProvider>
      <div className={styles.layout}>
        {children}
      </div>
    </BusinessDraftProvider>
  );
}
