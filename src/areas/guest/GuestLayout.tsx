import type { ReactNode } from 'react';
// Poppins lokal gehostet (DSGVO) – keine Anfragen an Google Fonts
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import '@fontsource/poppins/900.css';
import { LastUpdated } from './components/layout/LastUpdated';
import styles from './GuestLayout.module.css';

// Bis die Datenbank angebunden ist: Zeitpunkt des Builds, da die Seiten beim Deployment statisch erzeugt werden
const lastUpdated = new Date();

// Layout der Gastansicht (Figma-Datei 2) – mobile-first, Inhalt kommt später
export function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.layout} data-area="guest">
      {children}
      <LastUpdated date={lastUpdated} />
    </div>
  );
}
