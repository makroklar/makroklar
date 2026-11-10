import type { SupabaseClient } from '@supabase/supabase-js';

type Field = 'restaurantName' | 'email' | 'password' | 'termsAccepted';

export type RegistrationState = {
  status: 'idle' | 'error' | 'confirmation' | 'registered';
  message: string;
  fieldErrors: Partial<Record<Field, string>>;
  values: { restaurantName: string; email: string };
};

export const initialRegistrationState: RegistrationState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
  values: { restaurantName: '', email: '' },
};

const confirmationMessage = 'Bitte prüfe dein E-Mail-Postfach. Falls die Registrierung möglich ist, erhältst du einen Bestätigungslink.';
const failureMessage = 'Die Registrierung ist gerade nicht möglich. Bitte versuche es später erneut.';

// The injected operation keeps validation testable without creating accounts or sending mail.
export async function registerRestaurantAccount(
  formData: FormData,
  signUp: SupabaseClient['auth']['signUp'],
): Promise<RegistrationState> {
  function text(name: Field) {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  }

  const values = { restaurantName: text('restaurantName').trim(), email: text('email').trim() };
  const password = text('password');
  const fieldErrors: RegistrationState['fieldErrors'] = {};
  if (!values.restaurantName) fieldErrors.restaurantName = 'Bitte gib den Namen des Restaurants ein.';
  if (!/^[^\s@]+@[^\s@]+$/.test(values.email)) fieldErrors.email = 'Bitte gib eine gültige E-Mail-Adresse ein.';
  if (!password) fieldErrors.password = 'Bitte gib ein Passwort ein.';
  if (text('termsAccepted') !== 'on') fieldErrors.termsAccepted = 'Bitte akzeptiere die Bedingungen.';

  if (Object.keys(fieldErrors).length) {
    return { status: 'error', message: 'Bitte prüfe die markierten Felder.', fieldErrors, values };
  }

  try {
    const { data, error } = await signUp({
      email: values.email,
      password,
      options: { data: { restaurant_name: values.restaurantName } },
    });
    if (error) {
      let message = failureMessage;
      switch (error.code) {
        case 'weak_password':
          fieldErrors.password = 'Das Passwort erfüllt die Sicherheitsanforderungen nicht. Bitte wähle ein stärkeres Passwort.';
          message = 'Bitte prüfe dein Passwort.';
          break;
        case 'email_address_invalid':
          fieldErrors.email = 'Bitte gib eine gültige E-Mail-Adresse ein.';
          message = 'Bitte prüfe deine E-Mail-Adresse.';
          break;
        case 'over_email_send_rate_limit':
        case 'over_request_rate_limit':
          message = 'Zu viele Anfragen. Bitte warte etwas und versuche es erneut.';
          break;
        case 'user_already_exists':
        case 'email_exists':
          // Keep the response neutral, including when Auth reports an existing account.
          return { status: 'confirmation', message: confirmationMessage, fieldErrors: {}, values };
      }
      return { status: 'error', message, fieldErrors, values };
    }

    return {
      status: data.session ? 'registered' : 'confirmation',
      message: data.session ? 'Dein Benutzerkonto wurde erstellt.' : confirmationMessage,
      fieldErrors: {},
      values,
    };
  } catch {
    // Never serialize SDK errors, credentials or sessions into the form state.
    return { status: 'error', message: failureMessage, fieldErrors: {}, values };
  }
}
