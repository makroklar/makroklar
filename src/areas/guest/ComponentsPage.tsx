import pizzaMargheritaCard from '../../../public/images/guest/dishes/pizza-margherita.png';
import pizzaMargherita from '../../../public/images/guest/pizza-margherita.png';
import { CategoryTabsDemo } from './CategoryTabsDemo';
import { CarbsBreakdown } from './components/dish-detail/CarbsBreakdown';
import { DishAllergens } from './components/dish-detail/DishAllergens';
import { DishHero } from './components/dish-detail/DishHero';
import { DishInfo } from './components/dish-detail/DishInfo';
import { DishIngredients } from './components/dish-detail/DishIngredients';
import { LogoHeader } from './components/layout/LogoHeader';
import { DishCard } from './components/menu/DishCard';
import { OccupancyBadge } from './components/menu/OccupancyBadge';
import { InjectionHintDialogDemo } from './InjectionHintDialogDemo';
import { MenuHeaderDemo } from './MenuHeaderDemo';
import { OnboardingDialogDemo } from './OnboardingDialogDemo';
import styles from './ComponentsPage.module.css';

// Übersicht aller Komponenten der mobilen Gastansicht mit Beispieldaten, gruppiert nach Screens aus Figma
export function ComponentsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.title}>Komponenten</h1>

        <section className={styles.group} aria-labelledby="group-uebersicht">
          <h2 id="group-uebersicht" className={styles.groupTitle}>
            Seite: Übersicht
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
              image={pizzaMargheritaCard}
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

        <section className={styles.group} aria-labelledby="group-detailansicht">
          <h2 id="group-detailansicht" className={styles.groupTitle}>
            Seite: Detailansicht
          </h2>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>DishHero</h3>
            <div className={styles.fullBleed}>
              <DishHero name="Pizza Margherita" image={pizzaMargherita} backHref="/guest" />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>DishInfo</h3>
            <div className={styles.fullBleed}>
              <DishInfo
                name="Pizza Margherita"
                price={13.9}
                duration="ca. 15-25min"
                kcal={950}
                fat={34}
                protein={38}
                carbs={136}
                fpe={4.4}
                fpeHours="6-8"
              />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>CarbsBreakdown</h3>
            {/* Seitenabstände wie in Figma: 23 px links, 25 px rechts */}
            <div className={`${styles.fullBleed} ${styles.detailInset}`}>
              <CarbsBreakdown
                ingredients={[
                  { name: 'Pizzateig', amount: 280, carbsPerPortion: 130, carbsPer100g: 46 },
                  { name: 'Tomatensoße', amount: 80, carbsPerPortion: 4, carbsPer100g: 5 },
                  { name: 'Mozzarella', amount: 100, carbsPerPortion: 2, carbsPer100g: 2 },
                ]}
              />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>DishIngredients</h3>
            {/* Text 30 px vom linken Rand wie in Figma */}
            <div className={`${styles.fullBleed} ${styles.textInset}`}>
              <DishIngredients
                ingredients={['Pizzateig', 'Tomatensoße', 'Mozzarella', 'Olivenöl', 'frisches Basilikum']}
              />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>DishAllergens</h3>
            <div className={`${styles.fullBleed} ${styles.textInset}`}>
              <DishAllergens allergens={['Glutenhaltiges Getreide', 'Milch (Laktose)']} />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>InjectionHintDialog</h3>
            <InjectionHintDialogDemo />
          </section>
        </section>
      </div>
    </main>
  );
}
