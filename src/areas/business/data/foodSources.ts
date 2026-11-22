import type { StaticImageData } from 'next/image';
import type { FoodSourceId } from '../types/foodSource';
import wholesaleIcon from '../assets/supermarkt.svg';
import supermarketIcon from '../assets/basket.svg';
import regionalIcon from '../assets/loc-pin.svg';

interface FoodSourceOption {
  id: FoodSourceId;
  title: string;
  description: string;
  icon: StaticImageData;
}

export const foodSources: readonly FoodSourceOption[] = [
  {
    id: 'wholesale',
    title: 'Großhandel.',
    description:
      'Verbinde dein Lieferanten-Konto (z. B. BLF Gruppe) für einen automatischen Import deiner Bestellhistorie und Nährwertdaten.',
    icon: wholesaleIcon,
  },
  {
    id: 'supermarket',
    title: 'Supermarkt.',
    description:
      'Wähle deine Supermärkte (z. B. REWE oder EDEKA) aus, um die Nährwerte deiner Zutaten direkt aus deren Datenbanken abzurufen.',
    icon: supermarketIcon,
  },
  {
    id: 'regional',
    title: 'Regional.',
    description:
      'Scanne die Etiketten regionaler Anbieter oder lade sie als Foto hoch, um die Nährwerte automatisch zu erfassen.',
    icon: regionalIcon,
  },
];
