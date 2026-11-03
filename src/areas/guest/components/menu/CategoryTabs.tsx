'use client';

import { useEffect, useRef } from 'react';
import styles from './CategoryTabs.module.css';

type CategoryTabsProps = {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
};

// Kategorie-Leiste der Speisekarte (Figma „Gastansicht“, Frame 76) – horizontal scrollbar
export function CategoryTabs({ categories, active, onSelect }: CategoryTabsProps) {
  const listRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Aktive Kategorie in der Leiste sichtbar halten – nur waagerecht, die Seite selbst scrollt nicht mit
  useEffect(() => {
    const list = listRef.current;
    const tab = activeRef.current;
    if (!list || !tab) return;
    const tabStart = tab.offsetLeft - list.offsetLeft;
    const tabEnd = tabStart + tab.offsetWidth;
    if (tabStart < list.scrollLeft) list.scrollTo({ left: tabStart, behavior: 'smooth' });
    else if (tabEnd > list.scrollLeft + list.clientWidth)
      list.scrollTo({ left: tabEnd - list.clientWidth, behavior: 'smooth' });
  }, [active]);

  return (
    <nav ref={listRef} className={styles.tabs} aria-label="Kategorien">
      {categories.map((category) => {
        const isActive = category === active;
        return (
          <button
            key={category}
            ref={isActive ? activeRef : undefined}
            type="button"
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            aria-pressed={isActive}
            onClick={() => onSelect(category)}
          >
            {category}
          </button>
        );
      })}
    </nav>
  );
}
