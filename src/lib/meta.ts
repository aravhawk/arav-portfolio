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
  /** The title Open Graph and Twitter show, when it should not be `title · Arav Jain` (a post's own title stands alone). */
  shareTitle?: string;
}

/**
 * One shape for every route's metadata: canonical URL, Open Graph and
 * Twitter card. Child routes replace the parent's openGraph object whole, so
 * the shared fields are repeated here on purpose. The card image comes from
 * each route's opengraph-image file.
 */
export function pageMeta({ title, description, path, type = 'website', publishedTime, tags, tabTitle, shareTitle }: PageMeta): Metadata {
  // The tab's title takes the layout's template (`%s · Arav Jain`); a card has no template, so it is given whole.
  const share = shareTitle ?? `${title} · ${SITE_NAME}`;
  return {
    title: tabTitle ?? title,
    description,
    alternates: { canonical: path, types: { 'application/rss+xml': '/feed.xml' } },
    openGraph: {
      title: share,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: 'en_US',
      type,
      ...(type === 'article' ? { publishedTime, tags, authors: [SITE_NAME] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: share,
      description,
      creator: '@aravhawk',
      site: '@aravhawk',
    },
  };
}
