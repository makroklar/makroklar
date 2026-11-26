import { ManualMenuPage } from '@/areas/business/ManualMenuPage';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  return <ManualMenuPage />;
}
