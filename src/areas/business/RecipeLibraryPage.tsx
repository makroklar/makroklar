import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from './components/dashboard/PageHeader';
import { RecipeLibrary } from './components/menu/RecipeLibrary';
import { getRestaurantData } from './data/restaurantData';
import ui from './components/dashboard/Dashboard.module.css';

export async function RecipeLibraryPage() {
  const { dishes } = await getRestaurantData();

  return (
    <div className={ui.page}>
      <PageHeader
        title="Rezeptbibliothek"
        subtitle="Alle Gerichte und Basen, mit ihrem aktuellen Datenstand."
        actions={(
          <Link className={ui.primaryButton} href="/business/hinzufuegen">
            Neues Rezept <Plus aria-hidden="true" size={20} />
          </Link>
        )}
      />
      <RecipeLibrary recipes={dishes} />
    </div>
  );
}
