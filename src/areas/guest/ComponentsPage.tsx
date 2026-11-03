import pizzaMargherita from '../../../public/images/guest/pizza-margherita.png';
import { CategoryTabsDemo } from './CategoryTabsDemo';
import { LogoHeader } from './components/layout/LogoHeader';
import { DishCard } from './components/menu/DishCard';
import { OccupancyBadge } from './components/menu/OccupancyBadge';
import { MenuHeaderDemo } from './MenuHeaderDemo';
import { OnboardingDialogDemo } from './OnboardingDialogDemo';
import styles from './ComponentsPage.module.css';

// Übersicht aller Komponenten der mobilen Gastansicht mit Beispieldaten, gruppiert nach Screens aus Figma
export function ComponentsPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Komponenten</h1>

      <section className={styles.group} aria-labelledby="group-uebersicht">
        <h2 id="group-uebersicht" className={styles.groupTitle}>
          Übersicht
        </h2>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>LogoHeader</h3>
          <div className={styles.fullBleed}>
            <LogoHeader />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>MenuHeader</h3>
          {/* Volle Bildschirmbreite wie in der echten Speisekarte */}
          <div className={styles.fullBleed}>
            <MenuHeaderDemo />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>OccupancyBadge</h3>
          <OccupancyBadge status="Normaler Betrieb" />
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>CategoryTabs</h3>
          <CategoryTabsDemo />
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>DishCard</h3>
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
          <h3 className={styles.sectionTitle}>OnboardingDialog</h3>
          <OnboardingDialogDemo />
        </section>
      </section>
    </main>
  );
}
