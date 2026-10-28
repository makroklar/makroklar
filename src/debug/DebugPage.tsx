import { Link, type RouteObject } from 'react-router';
import { landingRoutes } from '../areas/landing/routes';
import { businessRoutes } from '../areas/business/routes';
import { guestRoutes } from '../areas/guest/routes';
import styles from './DebugPage.module.css';

const areas = [
  { name: 'Landingpage', routes: landingRoutes },
  { name: 'Restaurantansicht', routes: businessRoutes },
  { name: 'Gastansicht', routes: guestRoutes },
];

/** Sammelt alle aufrufbaren Pfade aus der Routen-Konfiguration (Layouts ohne eigene Seite werden übersprungen) */
function collectPaths(routes: RouteObject[], parentPath = ''): string[] {
  return routes.flatMap((route) => {
    let path = parentPath;
    if (route.path) {
      path = route.path.startsWith('/') ? route.path : `${parentPath.replace(/\/$/, '')}/${route.path}`;
    }

    const isPage = route.index || (route.path && route.element && !route.children);
    const ownPath = isPage ? [path || '/'] : [];

    return route.children ? [...ownPath, ...collectPaths(route.children, path)] : ownPath;
  });
}

export function DebugPage() {
  return (
    <main className={styles.page}>
      <h1>Debug: alle Routen</h1>
      <p className={styles.hint}>Wird automatisch aus den routes.tsx der Bereiche erzeugt.</p>

      {areas.map((area) => (
        <section key={area.name} className={styles.area}>
          <h2>{area.name}</h2>
          <ul className={styles.list}>
            {collectPaths(area.routes).map((path) => (
              <li key={path}>
                {/* Pfade mit Parametern (z. B. :id) lassen sich nicht direkt verlinken */}
                {path.includes(':') ? <code>{path}</code> : <Link to={path}>{path}</Link>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
