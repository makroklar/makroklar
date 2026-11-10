import type { SupabaseClient } from '@supabase/supabase-js';

export type LoginState = {
  status: 'idle' | 'error' | 'authenticated';
  message: string;
  fieldErrors: Partial<Record<'email' | 'password', string>>;
  email: string;
};

export const initialLoginState: LoginState = {
  status: 'idle', message: '', fieldErrors: {}, email: '',
};

const failureMessage = 'Die Anmeldung ist gerade nicht möglich. Bitte versuche es später erneut.';

export async function loginWithPassword(
  formData: FormData,
  signIn: SupabaseClient['auth']['signInWithPassword'],
): Promise<LoginState> {
  const emailValue = formData.get('email');
  const passwordValue = formData.get('password');
  const email = typeof emailValue === 'string' ? emailValue.trim() : '';
  const password = typeof passwordValue === 'string' ? passwordValue : '';
  const fieldErrors: LoginState['fieldErrors'] = {};
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) fieldErrors.email = 'Bitte gib eine gültige E-Mail-Adresse ein.';
  if (!password) fieldErrors.password = 'Bitte gib dein Passwort ein.';
  if (Object.keys(fieldErrors).length) {
    return { status: 'error', message: 'Bitte prüfe die markierten Felder.', fieldErrors, email };
  }

  try {
    const { data, error } = await signIn({ email, password });
    if (error) {
      let message = failureMessage;
      switch (error.code) {
        case 'invalid_credentials':
          message = 'E-Mail-Adresse oder Passwort ist nicht korrekt.';
          break;
        case 'email_not_confirmed':
          message = 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in deinem Postfach.';
          break;
        case 'over_request_rate_limit':
          message = 'Zu viele Anmeldeversuche. Bitte warte etwas und versuche es erneut.';
          break;
      }
      return { status: 'error', message, fieldErrors: {}, email };
    }
    if (!data.session) return { status: 'error', message: failureMessage, fieldErrors: {}, email };

    // Session cookies are managed by the server client; no tokens enter the form state.
    return { status: 'authenticated', message: '', fieldErrors: {}, email };
  } catch {
    return { status: 'error', message: failureMessage, fieldErrors: {}, email };
  }
}
