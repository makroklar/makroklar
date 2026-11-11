import pizzaMargheritaFull from '../../../../public/images/guest/pizza-margherita.png';
import type { CarbsIngredient } from '../components/dish-detail/CarbsBreakdown';
import { demoDishes } from './demoMenu';

// Beispiel-Detailansicht aus Figma („Gastansicht“, Frame „Detailansicht“) – wird durch die Datenbank ersetzt

const carbsBreakdown: CarbsIngredient[] = [
  { name: 'Pizzateig', amount: 280, carbsPerPortion: 130, carbsPer100g: 46 },
  { name: 'Tomatensoße', amount: 80, carbsPerPortion: 4, carbsPer100g: 5 },
  { name: 'Mozzarella', amount: 100, carbsPerPortion: 2, carbsPer100g: 2 },
];

const margherita = demoDishes.find((dish) => dish.id === 'pizza-margherita')!;

export const demoDishDetail = {
  name: margherita.name,
  price: margherita.price,
  kcal: margherita.kcal,
  fat: margherita.fat,
  protein: margherita.protein,
  // Summe der aufgeschlüsselten Zutaten (Figma: 136 g in der Detailansicht, 133 g in der Speisekarte)
  carbs: carbsBreakdown.reduce((sum, ingredient) => sum + ingredient.carbsPerPortion, 0),
  /** Freigestelltes Bild in voller Größe für den Bildbereich */
  heroImage: pizzaMargheritaFull,
  duration: 'ca. 15-25min',
  fpe: 4.4,
  fpeHours: '6-8',
  carbsBreakdown,
  ingredients: ['Pizzateig', 'Tomatensoße', 'Mozzarella', 'Olivenöl', 'frisches Basilikum'],
  allergens: ['Glutenhaltiges Getreide', 'Milch (Laktose)'],
};
