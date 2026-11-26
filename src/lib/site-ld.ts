import { CONTACT } from '@/content/projects';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';

/**
 * Structured data: who this is and which address is the real one. It is said once, on the home page (the site's own
 * address is what it describes), not in every page's HTML: an inner page's HTML has to fit what a new connection
 * sends before it waits (docs/site-system/performance.md), and this was 290 bytes of each.
 */
/**
 * The entries' `@id`s are the site's address with the fragment on it, no slash between (`https://arav.pro#person`),
 * the same form as the canonical, og:url and the sitemap (src/lib/site.ts). The work pages and posts refer to them.
 */
export const PERSON_ID = `${SITE_URL}#person`;
export const WEBSITE_ID = `${SITE_URL}#website`;

export const SITE_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': PERSON_ID,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_TAGLINE,
      jobTitle: 'Co-founder, Infiniflop Labs',
      worksFor: { '@type': 'Organization', name: 'Infiniflop Labs', url: 'https://infiniflop.com' },
      sameAs: [CONTACT.github, CONTACT.x, CONTACT.linkedin],
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': PERSON_ID },
    },
  ],
};
