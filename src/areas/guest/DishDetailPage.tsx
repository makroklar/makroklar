import { CarbsBreakdown } from './components/dish-detail/CarbsBreakdown';
import { DishAllergens } from './components/dish-detail/DishAllergens';
import { DishHero } from './components/dish-detail/DishHero';
import { DishInfo } from './components/dish-detail/DishInfo';
import { DishIngredients } from './components/dish-detail/DishIngredients';
import { demoDishDetail as dish } from './data/demoDishDetail';
import styles from './DishDetailPage.module.css';

// Detailansicht eines Gerichts (Figma „Gastansicht“, Frame „Detailansicht“) – vorerst mit Beispieldaten
export function DishDetailPage() {
  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <DishHero name={dish.name} image={dish.heroImage} backHref="/guest" />
      </div>

      <div className={styles.info}>
        <DishInfo
          name={dish.name}
          price={dish.price}
          duration={dish.duration}
          kcal={dish.kcal}
          fat={dish.fat}
          protein={dish.protein}
          carbs={dish.carbs}
          fpe={dish.fpe}
          fpeHours={dish.fpeHours}
        />
      </div>

      <div className={styles.carbs}>
        <CarbsBreakdown ingredients={dish.carbsBreakdown} />
      </div>

      <div className={styles.ingredients}>
        <DishIngredients ingredients={dish.ingredients} />
      </div>

      <div className={styles.allergens}>
        <DishAllergens allergens={dish.allergens} />
      </div>
    </main>
  );
}
