import type { MetadataRoute } from 'next';
import { SITE_URL, abs } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: abs('/sitemap.xml'),
    host: SITE_URL,
  };
}
