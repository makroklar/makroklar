import type { ReactNode } from 'react';
import { DashboardShell } from '@/areas/business/DashboardShell';
import { requireBusinessAccount } from '@/areas/business/auth/requireBusinessAccount';

// Route-Gruppe: alle Seiten mit Seitenleiste; Login, Registrierung und Onboarding liegen außerhalb
export default async function Layout({ children }: { children: ReactNode }) {
  await requireBusinessAccount();
  return <DashboardShell>{children}</DashboardShell>;
}
