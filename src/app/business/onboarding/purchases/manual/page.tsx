import { ManualFoodPage } from '@/areas/business/ManualFoodPage';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  return <ManualFoodPage />;
}
