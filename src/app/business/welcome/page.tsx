import { WelcomePage } from '@/areas/business/WelcomePage';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  return <WelcomePage />;
}
