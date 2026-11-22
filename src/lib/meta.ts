import type { Metadata } from 'next';
import { SITE_NAME } from './site';

interface PageMeta {
  /** Full share title. The browser title uses the layout's template. */
  title: string;
  description: string;
  /** Path from the site root, e.g. "/work/infiniview". */
  path: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  tags?: string[];
  /** Title for the browser tab when it should differ from the share title. */
  tabTitle?: string | { absolute: string };
}

/**
 * One shape for every route's metadata: canonical URL, Open Graph and
 * Twitter card. Child routes replace the parent's openGraph object whole, so
 * the shared fields are repeated here on purpose. The card image comes from
 * each route's opengraph-image file.
 */
export function pageMeta({ title, description, path, type = 'website', publishedTime, tags, tabTitle }: PageMeta): Metadata {
  return {
    title: tabTitle ?? title,
    description,
    alternates: { canonical: path, types: { 'application/rss+xml': '/feed.xml' } },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: 'en_US',
      type,
      ...(type === 'article' ? { publishedTime, tags, authors: [SITE_NAME] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: '@aravhawk',
      site: '@aravhawk',
    },
  };
}
