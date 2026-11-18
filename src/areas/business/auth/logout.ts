export type LogoutState = {
  status: 'idle' | 'error' | 'signed-out';
  message: string;
};

export const initialLogoutState: LogoutState = { status: 'idle', message: '' };
export const logoutFailureMessage = 'Die Abmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.';

// Await the server response before clearing the draft. This also finishes if the
// cookie update replaces the current account card and unmounts its LogoutButton.
export async function completeLocalLogout(
  performLogout: () => Promise<LogoutState>,
  resetDraft: () => void,
  navigate: (url: string) => void,
): Promise<LogoutState> {
  let state: LogoutState;
  try {
    state = await performLogout();
  } catch {
    return { status: 'error', message: logoutFailureMessage };
  }
  if (state.status === 'signed-out') {
    resetDraft();
    navigate('/business/login');
  }
  return state;
}
