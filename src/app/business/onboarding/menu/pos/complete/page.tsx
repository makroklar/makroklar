import { redirect } from 'next/navigation';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Page() {
  await requireBusinessAccount();
  // The former demo completion URL must not claim a real POS connection.
  redirect('/business/onboarding/menu/pos');
}
