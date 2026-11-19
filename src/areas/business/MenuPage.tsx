import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from './components/dashboard/PageHeader';
import { MenuDishes } from './components/menu/MenuDishes';
import { getRestaurantData } from './data/restaurantData';
import ui from './components/dashboard/Dashboard.module.css';

export async function MenuPage() {
  const { dishes } = await getRestaurantData();
  const live = dishes.filter(dish => dish.onMenu);

  return (
    <div className={ui.page}>
      <PageHeader
        title="Speisekarte"
        subtitle="Gerichte mit vollständig berechneten Nährwerten – so sehen deine Gäste sie."
        actions={(
          <Link className={ui.primaryButton} href="/business/rezepte">
            Aus Bibliothek hinzufügen <Plus aria-hidden="true" size={20} />
          </Link>
        )}
      />
      <MenuDishes dishes={live} />
    </div>
  );
}
