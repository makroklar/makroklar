'use server';

import { createClient } from '@/shared/supabase/server';
import { logoutFailureMessage, type LogoutState } from './logout';

export async function logout(): Promise<LogoutState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      // Local sign-out clears storage before best-effort server revocation.
      // This storage check is only for cleanup, never an authorization check.
      const local = await supabase.auth.getSession();
      if (local.error || local.data.session) {
        return { status: 'error', message: logoutFailureMessage };
      }
    }
    return { status: 'signed-out', message: '' };
  } catch {
    return { status: 'error', message: logoutFailureMessage };
  }
}
