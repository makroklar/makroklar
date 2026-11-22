import Link from 'next/link';
import { ArrowIcon } from './components/ui/ArrowIcon';
import { LoginForm } from './components/auth/LoginForm';
import styles from './RegistrationPage.module.css';

export function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link className={styles.backLink} href="/business/register">
          <ArrowIcon direction="left" />
          <span>Zurück</span>
        </Link>
        <div className={styles.content}>
          <header>
            <h1 className={styles.title}>Login</h1>
            <p className={styles.description}>Melde dich mit deinem Restaurantkonto an.</p>
          </header>
          <LoginForm />
          <p className={styles.loginPrompt}>
            Du hast noch kein Benutzerkonto?
            <Link className={styles.loginLink} href="/business/register">
              Hier gehts zur Registrierung.
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
