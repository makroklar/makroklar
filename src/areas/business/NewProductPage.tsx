'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ManualFoodForm } from './components/onboarding/ManualFoodEntry';
import { saveManualFood } from './data/saveDashboardAction';
import ui from './components/dashboard/Dashboard.module.css';

// „Neues Produkt“: Ware oder rohe Zutat mit Nährwerten vom Etikett anlegen (gleiche Eingabe wie im Onboarding)
export function NewProductPage() {
  const router = useRouter();

  return (
    <div className={ui.page}>
      <Link className={ui.backLink} href="/business/hinzufuegen">
        <ArrowLeft aria-hidden="true" size={16} /> Zurück
      </Link>
      <div className={`${ui.card} ${ui.cardBordered}`}>
        <ManualFoodForm
          cancelHref="/business/hinzufuegen"
          onSave={async food => {
            const result = await saveManualFood(food);
            if (result.status === 'error') return result.message;
            router.push('/business/rezepte');
            router.refresh();
            return null;
          }}
        />
      </div>
    </div>
  );
}
