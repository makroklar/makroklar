import type { StaticImageData } from 'next/image';
import caesarSalad from '../../../../public/images/guest/dishes/caesar-salad.png';
import lasagnaClassica from '../../../../public/images/guest/dishes/lasagna-classica.png';
import pizzaDiavolo from '../../../../public/images/guest/dishes/pizza-diavolo.png';
import pizzaMargherita from '../../../../public/images/guest/dishes/pizza-margherita.png';
import spaghettiBolognese from '../../../../public/images/guest/dishes/spaghetti-bolognese.png';
import tiramisu from '../../../../public/images/guest/dishes/tiramisu.png';
import type { DishCardProps } from '../components/menu/DishCard';

// Beispiel-Speisekarte aus Figma („Gastansicht“, Frame „Übersicht“) – wird durch die Datenbank ersetzt

export type Dish = DishCardProps & {
  id: string;
  image: StaticImageData | string;
  /** Kategorie aus der Leiste, „beliebt.“ wird über popular gesteuert */
  category: string;
  popular: boolean;
};

export const POPULAR = 'beliebt.';

export const demoRestaurant = {
  name: 'Pizzeria Dolomiti',
  occupancy: 'Normaler Betrieb',
  categories: [POPULAR, 'Vorspeise.', 'Hauptspeise.', 'Dessert.', 'Getränke.'],
};

// Bilder aus Figma, auf den dort sichtbaren Ausschnitt zugeschnitten
export const demoDishes: Dish[] = [
  {
    id: 'pizza-margherita',
    name: 'Pizza Margherita',
    description: 'mit fruchtiger Tomatensoße, cremigem Mozzarella und frischem Basilikum',
    price: 13.9,
    image: pizzaMargherita,
    kcal: 950,
    fat: 34,
    protein: 38,
    carbs: 133,
    category: 'Hauptspeise.',
    popular: true,
  },
  {
    id: 'pizza-diavolo',
    name: 'Pizza Diavolo',
    description: 'mit scharfer Salami, Mozzarella und aromatischer Tomatensoße.',
    price: 15.9,
    image: pizzaDiavolo,
    kcal: 1190,
    fat: 50,
    protein: 50,
    carbs: 137,
    category: 'Hauptspeise.',
    popular: true,
  },
  {
    id: 'lasagna-classica',
    name: 'Lasagna Classica',
    description: 'mit geschmorter Rinderhackfleisch-Bolognese, feiner Béchamelsoße und überbackenem Käse',
    price: 11.9,
    image: lasagnaClassica,
    kcal: 630,
    fat: 30,
    protein: 35,
    carbs: 62,
    category: 'Hauptspeise.',
    popular: true,
  },
  {
    id: 'spaghetti-bolognese',
    name: 'Spaghetti Bolognese',
    description: 'in herzhafter, original italienischer Rinderhackfleisch-Tomatensoße',
    price: 13.9,
    image: spaghettiBolognese,
    kcal: 652,
    fat: 20,
    protein: 30,
    carbs: 88,
    category: 'Hauptspeise.',
    popular: true,
  },
  {
    id: 'caesar-salad',
    name: 'Caesar Salad',
    description: 'Römersalat mit gegrillter Hähnchenbrust, Parmesan, Croutons und hausgemachtem Dressing.',
    price: 12.9,
    image: caesarSalad,
    kcal: 550,
    fat: 30,
    protein: 40,
    carbs: 26,
    category: 'Vorspeise.',
    popular: true,
  },
  {
    id: 'tiramisu',
    name: 'Tiramisu',
    description: 'aus in Espresso getränkten Löffelbiskuits, leichter Mascarpone-Creme und feinem Kakao',
    price: 8.9,
    image: tiramisu,
    kcal: 417,
    fat: 25,
    protein: 8,
    carbs: 40,
    category: 'Dessert.',
    popular: true,
  },
];
