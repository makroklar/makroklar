import type { MetadataRoute } from 'next';
import { siteUrl } from '@/areas/landing/lib/site';

const paths = ['', '/preise', '/hilfe', '/anleitung', '/ueber-uns', '/kontakt', '/impressum', '/datenschutz'];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((path) => ({ url: `${siteUrl}${path}` }));
}
