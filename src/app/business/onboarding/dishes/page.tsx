import { DishesSetupPage } from '@/areas/business/DishesSetupPage';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  return <DishesSetupPage />;
}
