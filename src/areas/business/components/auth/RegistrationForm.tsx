'use client';

import { useActionState } from 'react';
import { registerAccount } from '../../auth/registrationAction';
import { initialRegistrationState } from '../../auth/registration';
import styles from '../../RegistrationPage.module.css';

export function RegistrationForm() {
  const [state, formAction, pending] = useActionState(registerAccount, initialRegistrationState);
  const submitted = state.status === 'confirmation' || state.status === 'registered';
  const disabled = pending || submitted;

  return (
    <form action={formAction} aria-busy={pending}>
      <div className={styles.field}>
        <label htmlFor="restaurant-name">Name des Restaurants</label>
        <input
          className={styles.input}
          id="restaurant-name"
          name="restaurantName"
          type="text"
          autoComplete="organization"
          defaultValue={state.values.restaurantName}
          required
          disabled={disabled}
          aria-invalid={!!state.fieldErrors.restaurantName}
          aria-describedby={state.fieldErrors.restaurantName ? 'restaurant-name-error' : undefined}
        />
        {state.fieldErrors.restaurantName && <p className={styles.fieldError} id="restaurant-name-error">{state.fieldErrors.restaurantName}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="email">E-Mail-Adresse</label>
        <input
          className={styles.input}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values.email}
          required
          disabled={disabled}
          aria-invalid={!!state.fieldErrors.email}
          aria-describedby={state.fieldErrors.email ? 'email-error' : undefined}
        />
        {state.fieldErrors.email && <p className={styles.fieldError} id="email-error">{state.fieldErrors.email}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Passwort</label>
        <input
          className={styles.input}
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={disabled}
          aria-invalid={!!state.fieldErrors.password}
          aria-describedby={state.fieldErrors.password ? 'password-error' : undefined}
        />
        {state.fieldErrors.password && <p className={styles.fieldError} id="password-error">{state.fieldErrors.password}</p>}
      </div>
      <label className={styles.terms}>
        <input
          className={styles.checkbox}
          name="termsAccepted"
          type="checkbox"
          required
          disabled={disabled}
          aria-invalid={!!state.fieldErrors.termsAccepted}
          aria-describedby={state.fieldErrors.termsAccepted ? 'terms-error' : undefined}
        />
        <span>
          Ich habe die Allgemeinen Geschäftsbedingungen sowie die
          Datenschutzbestimmung gelesen und akzeptiere diese.
        </span>
      </label>
      {state.fieldErrors.termsAccepted && <p className={styles.fieldError} id="terms-error">{state.fieldErrors.termsAccepted}</p>}
      <button className={styles.registerButton} type="submit" disabled={disabled}>
        {pending ? 'Wird registriert …' : 'Registrieren'}
      </button>
      <p className={state.status === 'error' ? styles.formError : styles.formNote} role={state.status === 'error' ? 'alert' : 'status'}>
        {state.message || 'Bitte bestätige deine E-Mail-Adresse nach der Registrierung.'}
      </p>
    </form>
  );
}
