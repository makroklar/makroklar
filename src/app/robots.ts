import type { MetadataRoute } from 'next';
import { siteUrl } from '@/areas/landing/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/business', '/guest', '/debug'] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
