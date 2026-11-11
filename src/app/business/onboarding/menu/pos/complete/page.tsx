import { PosImportCompletePage } from '@/areas/business/PosImportCompletePage';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  return <PosImportCompletePage />;
}
