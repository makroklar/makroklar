'use server';

import { createClient } from '@/shared/supabase/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { registerRestaurantAccount, type RegistrationState } from './registration';
import { registrationCallbackUrl } from './registrationRedirect';

export async function registerAccount(
  _previousState: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const state = await registerRestaurantAccount(formData, async credentials => {
    const callbackUrl = registrationCallbackUrl((await headers()).get('origin'));
    const supabase = await createClient();
    return supabase.auth.signUp({
      ...credentials,
      options: { ...credentials.options, emailRedirectTo: callbackUrl },
    });
  });
  // Keep redirect outside the validation/error boundary: Next implements it by throwing.
  if (state.status === 'registered') redirect('/business/auth/callback');
  return state;
}
