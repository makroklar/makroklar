import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import styles from './DebugPage.module.css';

const APP_DIR = path.join(process.cwd(), 'src', 'app');

// Oberster Ordner in src/app → Bereich; Routengruppen wie (landing) tauchen nicht in der URL auf
const areas = [
  { name: 'Landingpage', folder: '(landing)' },
  { name: 'Restaurantansicht', folder: 'business' },
  { name: 'Gastansicht', folder: 'guest' },
];

/** Sammelt alle aufrufbaren Pfade: jeder Ordner mit page.tsx ist eine Seite */
function collectPaths(dir: string, urlPath: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const ownPath = entries.some((entry) => entry.name === 'page.tsx') ? [urlPath || '/'] : [];

  return [
    ...ownPath,
    ...entries
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const isGroup = entry.name.startsWith('(') && entry.name.endsWith(')');
        const segment = isGroup ? '' : `/${entry.name}`;
        return collectPaths(path.join(dir, entry.name), urlPath + segment);
      }),
  ];
}

export function DebugPage() {
  return (
    <main className={styles.page}>
      <h1>Debug: alle Routen</h1>
      <p className={styles.hint}>Wird automatisch aus den Ordnern in src/app erzeugt.</p>

      {areas.map((area) => {
        const isGroup = area.folder.startsWith('(');
        const paths = collectPaths(path.join(APP_DIR, area.folder), isGroup ? '' : `/${area.folder}`);

        return (
          <section key={area.name} className={styles.area}>
            <h2>{area.name}</h2>
            <ul className={styles.list}>
              {paths.map((url) => (
                <li key={url}>
                  {/* Pfade mit Parametern (z. B. [id]) lassen sich nicht direkt verlinken */}
                  {url.includes('[') ? <code>{url}</code> : <Link href={url}>{url}</Link>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
