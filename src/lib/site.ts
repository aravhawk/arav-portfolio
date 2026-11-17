/**
 * The one place the site's address lives. arav.pro is the canonical domain;
 * aravjain.dev redirects to it. Everything that needs an absolute URL
 * (metadata, sitemap, robots, feed, JSON-LD, Open Graph) reads this.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://arav.pro').replace(/\/$/, '');
export const SITE_NAME = 'Arav Jain';
export const SITE_TAGLINE = 'AI and developer tooling builder';
export const SITE_DESCRIPTION =
  'Arav Jain builds AI and developer tooling: Infiniview, agents that attack your app to prove what breaks, plus open source that developers run every day.';

/** Hosts that should answer with a permanent redirect to SITE_URL. */
export const REDIRECT_HOSTS = ['aravjain.dev', 'www.aravjain.dev', 'www.arav.pro'];

export const abs = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * The browser's own chrome takes the colour of the top edge of the page it
 * shows (measured from the first frame at phone width): the home page opens
 * on sky, every other page on pale land.
 */
export const THEME_COLOR = {
  home: { light: '#a5c3db', dark: '#41406e' },
  page: { light: '#e9edee', dark: '#1d2123' },
} as const;
