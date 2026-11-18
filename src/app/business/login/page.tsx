import { LoginPage } from '@/areas/business/LoginPage';
import { AccountStatusPage } from '@/areas/business/AccountStatusPage';
import { getAuthPageAccount } from '@/areas/business/auth/authPageAccount';

export default async function Page() {
  const account = await getAuthPageAccount();
  if (account.status !== 'anonymous') return <AccountStatusPage account={account} />;
  return <LoginPage />;
}
