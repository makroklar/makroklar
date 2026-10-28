import { Outlet } from 'react-router';
import styles from './BusinessLayout.module.css';

// Layout der Restaurantansicht (Figma-Datei 1) – Navigation usw. kommt später
export function BusinessLayout() {
  return (
    <div className={styles.layout}>
      <Outlet />
    </div>
  );
}
