import { CategoryTabs } from './CategoryTabs';
import { OccupancyBadge } from './OccupancyBadge';
import styles from './MenuHeader.module.css';

type MenuHeaderProps = {
  restaurantName: string;
  /** z. B. „Normaler Betrieb“ */
  occupancy: string;
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
};

// Kopfbereich der Speisekarte (Figma „Gastansicht“, Rectangle 98): Name, Auslastung, Hinweis, Kategorien
export function MenuHeader({
  restaurantName,
  occupancy,
  categories,
  activeCategory,
  onSelectCategory,
}: MenuHeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.name}>{restaurantName}</h1>
      <OccupancyBadge status={occupancy} />
      <p className={styles.notice}>
        Alle Angaben sind Richtwerte und dienen zur Orientierung. Portionsgrößen und Zubereitungszeiten können
        variieren.
      </p>
      <div className={styles.tabs}>
        <CategoryTabs categories={categories} active={activeCategory} onSelect={onSelectCategory} />
      </div>
    </header>
  );
}
