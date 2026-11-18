'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/shared/supabase/server';
import { loginWithPassword, type LoginState } from './login';

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const state = await loginWithPassword(formData, async credentials => {
    const supabase = await createClient();
    return supabase.auth.signInWithPassword(credentials);
  });
  // Reuse verified, retry-safe restaurant completion, including for existing accounts.
  if (state.status === 'authenticated') redirect('/business/auth/callback');
  return state;
}
