import { RegistrationPage } from '@/areas/business/RegistrationPage';
import { AccountStatusPage } from '@/areas/business/AccountStatusPage';
import { getAuthPageAccount } from '@/areas/business/auth/authPageAccount';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ registration?: string | string[] }>;
}) {
  const [{ registration }, account] = await Promise.all([searchParams, getAuthPageAccount()]);
  if (account.status !== 'anonymous') {
    return <AccountStatusPage account={account} setupError={registration === 'setup-error'} />;
  }
  const notice = registration === 'confirmation-error' || registration === 'setup-error'
    ? 'confirmation-error' : undefined;
  return <RegistrationPage notice={notice} />;
}
