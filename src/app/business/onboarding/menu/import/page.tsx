import { CsvMenuImportPage } from '@/areas/business/CsvMenuImportPage';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  return <CsvMenuImportPage />;
}
