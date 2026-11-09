'use client';

import { useState } from 'react';
import { DishCard } from './components/menu/DishCard';
import { MenuHeader } from './components/menu/MenuHeader';
import { POPULAR, demoDishes, demoRestaurant } from './data/demoMenu';
import styles from './MenuView.module.css';

// Speisekarte mit Kategorie-Auswahl (Figma „Gastansicht“, Frame „Übersicht“) – vorerst mit Beispieldaten
export function MenuView() {
  const [activeCategory, setActiveCategory] = useState(POPULAR);
  const dishes = demoDishes.filter((dish) =>
    activeCategory === POPULAR ? dish.popular : dish.category === activeCategory,
  );

  return (
    <main className={styles.menu}>
      <MenuHeader
        restaurantName={demoRestaurant.name}
        occupancy={demoRestaurant.occupancy}
        categories={demoRestaurant.categories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />

      {dishes.length > 0 ? (
        <ul className={styles.dishes}>
          {dishes.map(({ id, category, popular, ...dish }) => (
            <li key={id}>
              <DishCard {...dish} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>In dieser Kategorie gibt es noch keine Gerichte.</p>
      )}
    </main>
  );
}
