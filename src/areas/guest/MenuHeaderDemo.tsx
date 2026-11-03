'use client';

import { useState } from 'react';
import { MenuHeader } from './components/menu/MenuHeader';

const categories = ['beliebt.', 'Vorspeise.', 'Hauptspeise.', 'Dessert.', 'Getränke.'];

// Kopfbereich mit Beispieldaten für die Komponentenseite
export function MenuHeaderDemo() {
  const [active, setActive] = useState(categories[0]);

  return (
    <MenuHeader
      restaurantName="Pizzeria Dolomiti"
      occupancy="Normaler Betrieb"
      categories={categories}
      activeCategory={active}
      onSelectCategory={setActive}
    />
  );
}
