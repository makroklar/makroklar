import type { StaticImageData } from 'next/image';
import posIcon from '../assets/menu-import-pos.svg';
import uploadIcon from '../assets/menu-import-upload.svg';
import manualIcon from '../assets/menu-import-manual.svg';

export type MenuImportMethod = 'pos' | 'upload' | 'manual';

export interface MenuImportOption {
  id: MenuImportMethod;
  title: string;
  description: string;
  icon: StaticImageData;
  href?: string;
}

export const menuImportOptions: readonly MenuImportOption[] = [
  {
    id: 'pos',
    title: 'Mit Kassensystem verknüpfen.',
    description:
      'Verbinde dein System (z. B. Lightspeed) für den automatischen Import deiner Gerichte.',
    icon: posIcon,
    href: '/business/onboarding/menu/pos',
  },
  {
    id: 'upload',
    title: 'Speisekarte importieren.',
    description:
      'Lade deine Speisekarte als Datei (z. B. PDF) hoch, um deine Gerichte vom System automatisch auslesen zu lassen.',
    icon: uploadIcon,
  },
  {
    id: 'manual',
    title: 'Speisekarte manuell erstellen.',
    description:
      'Trage deine Gerichte händisch ein und baue deine Speisekarte flexibel selbst auf.',
    icon: manualIcon,
  },
];
