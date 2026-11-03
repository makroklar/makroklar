import Image from 'next/image';
import Link from 'next/link';
import { ArrowIcon } from './components/ui/ArrowIcon';
import styles from './WelcomePage.module.css';

export function WelcomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <Image
          src="/images/brand/makroklar-logo.svg"
          alt="makroklar"
          width={188}
          height={41}
        />
      </div>
      <div className={styles.card}>
        <Link className={styles.backLink} href="/business/register">
          <ArrowIcon direction="left" />
          <span>Zurück</span>
        </Link>
        <div className={styles.content}>
          <h1 className={styles.title}>
            Willkommen bei makro<span className={styles.accent}>klar.</span>
          </h1>
          <div className={styles.copy}>
            <p>
              Schön, dass du gemeinsam mit uns für mehr Nährwert-Transparenz in der
              Gastronomie sorgst. Wir automatisieren deine Nährwertberechnung im
              Hintergrund, sodass dir mehr Zeit für das Wesentliche bleibt.
            </p>
            <p>
              Lass uns direkt starten und deine Speisekarte in wenigen
              automatisierten Schritten importieren.
            </p>
          </div>
          <Link
            className={styles.startButton}
            href="/business/onboarding/menu"
          >
            <span>Jetzt starten.</span>
            <ArrowIcon tone="accent" />
          </Link>
        </div>
      </div>
    </main>
  );
}
