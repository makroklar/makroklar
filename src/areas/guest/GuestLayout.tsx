import { Outlet } from 'react-router';
import styles from './GuestLayout.module.css';

// Layout der Gastansicht (Figma-Datei 2) – mobile-first, Inhalt kommt später
export function GuestLayout() {
  return (
    <div className={styles.layout}>
      <Outlet />
    </div>
  );
}
