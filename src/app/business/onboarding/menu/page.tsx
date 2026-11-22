import { MenuImportPage } from '@/areas/business/MenuImportPage';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  return <MenuImportPage />;
}
