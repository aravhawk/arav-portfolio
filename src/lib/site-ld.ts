import { CONTACT } from '@/content/projects';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';

/**
 * Structured data: who this is and which address is the real one. It is said once, on the home page (the site's own
 * address is what it describes), not in every page's HTML: an inner page's HTML has to fit what a new connection
 * sends before it waits (docs/site-system/performance.md), and this was 290 bytes of each.
 */
export const SITE_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#person`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_TAGLINE,
      jobTitle: 'Co-founder, Infiniflop Labs',
      worksFor: { '@type': 'Organization', name: 'Infiniflop Labs', url: 'https://infiniflop.com' },
      sameAs: [CONTACT.github, CONTACT.x, CONTACT.linkedin],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': `${SITE_URL}/#person` },
    },
  ],
};
