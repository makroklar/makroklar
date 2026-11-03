import pizzaMargherita from '../../../public/images/guest/pizza-margherita.png';
import { CategoryTabsDemo } from './CategoryTabsDemo';
import { DishCard } from './components/menu/DishCard';
import { OccupancyBadge } from './components/menu/OccupancyBadge';
import { OnboardingDialogDemo } from './OnboardingDialogDemo';
import styles from './ComponentsPage.module.css';

// Übersicht aller Komponenten der mobilen Gastansicht mit Beispieldaten
export function ComponentsPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Komponenten</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>OccupancyBadge</h2>
        <OccupancyBadge status="Normaler Betrieb" />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>CategoryTabs</h2>
        <CategoryTabsDemo />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>DishCard</h2>
        <DishCard
          name="Pizza Margherita"
          description="mit fruchtiger Tomatensoße, cremigem Mozzarella und frischem Basilikum"
          price={13.9}
          image={pizzaMargherita}
          kcal={950}
          fat={34}
          protein={38}
          carbs={133}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>OnboardingDialog</h2>
        <OnboardingDialogDemo />
      </section>
    </main>
  );
}
