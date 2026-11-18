import type { ReactNode } from 'react';
import { OnboardingLayout } from '@/areas/business/OnboardingLayout';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

export default async function Layout({ children }: { children: ReactNode }) {
  await requireBusinessAccount();
  return <OnboardingLayout>{children}</OnboardingLayout>;
}
