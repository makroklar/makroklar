import Link from 'next/link';
import { ArrowIcon } from './components/ui/ArrowIcon';
import { RegistrationForm } from './components/auth/RegistrationForm';
import styles from './RegistrationPage.module.css';

export function RegistrationPage({ notice }: { notice?: 'confirmation-error' | 'setup-error' } = {}) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link className={styles.backLink} href="/">
          <ArrowIcon direction="left" />
          <span>Zurück</span>
        </Link>
        <div className={styles.content}>
          <header>
            <h1 className={styles.title}>Registrierung</h1>
            <p className={styles.description}>
              Hier kannst du kostenlos ein Benutzerkonto erstellen.
            </p>
          </header>
          {notice && (
            <div className={styles.registrationNotice}>
              <p className={styles.formError} role="alert">
                {notice === 'setup-error'
                  ? 'Deine E-Mail-Adresse ist bestätigt. Die Einrichtung deines Restaurants konnte noch nicht abgeschlossen werden.'
                  : 'Die Anmeldung über diesen Bestätigungslink konnte nicht abgeschlossen werden. Falls deine E-Mail-Adresse bereits bestätigt ist, melde dich an.'}
              </p>
              <Link className={styles.loginLink} href="/business/auth/callback">
                Einrichtung erneut versuchen
              </Link>
            </div>
          )}
          {notice !== 'setup-error' && <RegistrationForm />}
          <p className={styles.loginPrompt}>
            Du hast schon ein Benutzerkonto?
            <Link className={styles.loginLink} href="/business/login">
              Hier gehts zum Login.
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
