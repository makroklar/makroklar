'use client';

import { useState } from 'react';
import { CategoryTabs } from './components/menu/CategoryTabs';

const categories = ['beliebt.', 'Vorspeise.', 'Hauptspeise.', 'Dessert.', 'Getränke.'];

// Kategorie-Leiste mit Beispieldaten für die Komponentenseite
export function CategoryTabsDemo() {
  const [active, setActive] = useState(categories[0]);

  return <CategoryTabs categories={categories} active={active} onSelect={setActive} />;
}
