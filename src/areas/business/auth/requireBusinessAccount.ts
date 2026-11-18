import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getAuthPageAccount } from './authPageAccount';

// Deduplicate only within the current server render, never across user requests.
export const requireBusinessAccount = cache(async () => {
  const account = await getAuthPageAccount();
  if (account.status !== 'signed-in') {
    // Login already distinguishes missing sessions from an unavailable Auth service.
    redirect('/business/login');
  }
  return account;
});
