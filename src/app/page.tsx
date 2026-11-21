import type { Viewport } from 'next';
import { FlightPage } from '@/components/flight/FlightPage';
import { CONTACT } from '@/content/projects';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, THEME_COLOR } from '@/lib/site';

/**
 * The home page: the flight, played from the frames rendered ahead of time
 * (see FlightPage and src/flight).
 */

// Live numbers are read on the server and cached for an hour. A visitor's
// page view never reaches GitHub, npm or Ollama.
export const revalidate = 3600;

// The browser's chrome takes the colour of the first frame's sky.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.home.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.home.dark },
  ],
};

/* Structured data: who this is and which address is the real one. It describes the site and its owner, so it is said
   once, here on the home page: said in the root layout it was 0.6 kB of every page's HTML (twice: in the head and in
   the data the page hydrates from). A post says its own (src/app/blog/[slug]/page.tsx). */
const jsonLd = {
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

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FlightPage />
    </>
  );
}
