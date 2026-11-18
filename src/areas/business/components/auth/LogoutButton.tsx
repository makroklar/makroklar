'use client';

import { useActionState } from 'react';
import { logout } from '../../auth/logoutAction';
import { completeLocalLogout, initialLogoutState } from '../../auth/logout';
import { useBusinessDraft } from '../../state/BusinessDraftContext';
import styles from './LogoutButton.module.css';

export function LogoutButton() {
  const { resetDraft } = useBusinessDraft();
  const [state, formAction, pending] = useActionState(
    () => completeLocalLogout(logout, resetDraft, url => window.location.replace(url)),
    initialLogoutState,
  );

  return (
    <form className={styles.form} action={formAction} aria-busy={pending}>
      <button className={styles.button} type="submit" disabled={pending || state.status === 'signed-out'}>
        {pending ? 'Wird abgemeldet …' : 'Abmelden'}
      </button>
      {state.message && <p className={styles.error} role="alert">{state.message}</p>}
    </form>
  );
}
