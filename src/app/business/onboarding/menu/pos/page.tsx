import { PosImportPage } from '@/areas/business/PosImportPage';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  return <PosImportPage />;
}
