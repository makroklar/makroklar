import Link from 'next/link';
import type { AuthPageAccount } from './auth/authPageAccount';
import { ArrowIcon } from './components/ui/ArrowIcon';
import { LogoutButton } from './components/auth/LogoutButton';
import styles from './RegistrationPage.module.css';

export function AccountStatusPage({ account, setupError = false }: {
  account: Exclude<AuthPageAccount, { status: 'anonymous' }>;
  setupError?: boolean;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link className={styles.backLink} href="/">
          <ArrowIcon direction="left" />
          <span>Zurück</span>
        </Link>
        <div className={styles.content}>
          {account.status === 'signed-in' ? (
            <>
              <h1 className={styles.title}>Du bist bereits angemeldet.</h1>
              <p className={styles.description}>Angemeldet als</p>
              <p className={styles.accountEmail}>{account.email}</p>
              {setupError && (
                <p className={styles.formError} role="alert">
                  Die Einrichtung deines Restaurants konnte noch nicht abgeschlossen werden. Bitte versuche es erneut.
                </p>
              )}
              <Link className={styles.registerButton} href="/business/auth/callback">
                {setupError ? 'Einrichtung erneut versuchen' : 'Weiter zu makroklar'}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <h1 className={styles.title}>Anmeldung prüfen</h1>
              <p className={styles.description} role="alert">
                Dein Anmeldestatus konnte gerade nicht geprüft werden. Bitte versuche es erneut.
              </p>
              <Link className={styles.registerButton} href="/business/login">Erneut versuchen</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
