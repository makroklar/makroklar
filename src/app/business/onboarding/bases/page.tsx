import { BasisRecipesPage } from '@/areas/business/BasisRecipesPage';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  return <BasisRecipesPage />;
}
