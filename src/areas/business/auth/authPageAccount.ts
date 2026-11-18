import { createClient } from '@/shared/supabase/server';

export type AuthPageAccount =
  | { status: 'anonymous' }
  | { status: 'signed-in'; email: string }
  | { status: 'unavailable' };

export async function getAuthPageAccount(): Promise<AuthPageAccount> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (error.name === 'AuthSessionMissingError' || error.status === 401
          || error.status === 403 || error.code === 'bad_jwt') {
        return { status: 'anonymous' };
      }
      return { status: 'unavailable' };
    }
    if (!data.user) return { status: 'anonymous' };
    if (!data.user.email) return { status: 'unavailable' };
    // Only the verified account email is sent to the view, never the full Auth response.
    return { status: 'signed-in', email: data.user.email };
  } catch {
    return { status: 'unavailable' };
  }
}
