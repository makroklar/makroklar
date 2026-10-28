import { Outlet } from 'react-router';
// Poppins lokal gehostet (DSGVO) – keine Anfragen an Google Fonts
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import '@fontsource/poppins/900.css';
import styles from './GuestLayout.module.css';

// Layout der Gastansicht (Figma-Datei 2) – mobile-first, Inhalt kommt später
export function GuestLayout() {
  return (
    <div className={styles.layout} data-area="guest">
      <Outlet />
    </div>
  );
}
