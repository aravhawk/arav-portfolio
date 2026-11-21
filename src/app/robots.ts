import type { MetadataRoute } from 'next';
import { SITE_URL, abs } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // (The renderer's own route: the home page drawn live, for tools/flight.)
      disallow: '/render',
    },
    sitemap: abs('/sitemap.xml'),
    host: SITE_URL,
  };
}
