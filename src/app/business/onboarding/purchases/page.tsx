import { PurchasesPage } from '@/areas/business/PurchasesPage';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  return <PurchasesPage />;
}
