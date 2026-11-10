import type { Metadata } from 'next';
import { LandingLayout } from '@/areas/landing/LandingLayout';
import { siteUrl } from '@/areas/landing/lib/site';

const description =
  'makroklar macht aus Rezepten verständliche Nährwert- und Allergenangaben für Speisekarten, auf denen Menschen sicherer auswählen können.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'makroklar – Nährwerte verständlich', template: '%s | makroklar' },
  description,
  openGraph: {
    title: 'makroklar – Nährwerte verständlich',
    description,
    type: 'website',
    locale: 'de_DE',
    siteName: 'makroklar',
  },
};

export default LandingLayout;
