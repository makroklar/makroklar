'use client';

import { useActionState } from 'react';
import { login } from '../../auth/loginAction';
import { initialLoginState } from '../../auth/login';
import styles from '../../RegistrationPage.module.css';

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialLoginState);
  const disabled = pending || state.status === 'authenticated';

  return (
    <form action={formAction} aria-busy={pending}>
      <div className={styles.field}>
        <label htmlFor="login-email">E-Mail-Adresse</label>
        <input
          className={styles.input}
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          required
          disabled={disabled}
          aria-invalid={!!state.fieldErrors.email}
          aria-describedby={state.fieldErrors.email ? 'login-email-error' : undefined}
        />
        {state.fieldErrors.email && <p className={styles.fieldError} id="login-email-error">{state.fieldErrors.email}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="login-password">Passwort</label>
        <input
          className={styles.input}
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={disabled}
          aria-invalid={!!state.fieldErrors.password}
          aria-describedby={state.fieldErrors.password ? 'login-password-error' : undefined}
        />
        {state.fieldErrors.password && <p className={styles.fieldError} id="login-password-error">{state.fieldErrors.password}</p>}
      </div>
      <button className={styles.registerButton} type="submit" disabled={disabled}>
        {pending ? 'Wird angemeldet …' : 'Anmelden'}
      </button>
      <p className={styles.formError} role="alert">{state.message}</p>
    </form>
  );
}
