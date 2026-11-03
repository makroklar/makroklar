import Link from 'next/link';
import { ArrowIcon } from './components/ui/ArrowIcon';
import styles from './RegistrationPage.module.css';

export function RegistrationPage() {
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
          <div className={styles.field}>
            <label htmlFor="restaurant-name">Name des Restaurants</label>
            <input
              className={styles.input}
              id="restaurant-name"
              name="restaurantName"
              type="text"
              autoComplete="organization"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="username">Nutzername</label>
            <input
              className={styles.input}
              id="username"
              name="username"
              type="text"
              autoComplete="username"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Passwort</label>
            <input
              className={styles.input}
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
            />
          </div>
          <label className={styles.terms}>
            <input
              className={styles.checkbox}
              name="termsAccepted"
              type="checkbox"
            />
            <span>
              Ich habe die Allgemeinen Geschäftsbedingungen sowie die
              Datenschutzbestimmung gelesen und akzeptiere diese.
            </span>
          </label>
          <Link
            className={styles.registerButton}
            href="/business/welcome"
            aria-describedby="registration-note"
          >
            Registrieren
          </Link>
          <p className={styles.prototypeNote} id="registration-note">
            Prototyp: Weiter ohne Konto. Die Eingaben werden nicht gespeichert.
          </p>
          <p className={styles.loginPrompt}>
            Du hast schon ein Benutzerkonto?
            <span
              className={styles.loginLink}
              role="link"
              aria-disabled="true"
              title="Login ist noch nicht verfügbar."
            >
              Hier gehts zum Login.
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}
