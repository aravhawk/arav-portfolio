import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ViewTransition } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Chrome } from '@/components/Chrome';
import { CONTACT } from '@/content/projects';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, THEME_COLOR } from '@/lib/site';
import './globals.css';

/* Type: see docs/redesign-v4/typography.md and font-licenses.md.
   All faces are SIL OFL 1.1 and self hosted from src/fonts. */
const orbiter = localFont({
  src: '../fonts/TASAOrbiter-VF.woff2',
  variable: '--f-orbiter',
  weight: '400 800',
  display: 'swap',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});
const mono = localFont({
  src: '../fonts/SplineSansMono-VF.woff2',
  variable: '--f-spline',
  weight: '300 700',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'Menlo', 'monospace'],
});
/* The serif is an accent: the two sentences in his own voice and nothing
   else. A display-size instance, Latin only, so it costs under 50 KB. */
const accent = localFont({
  src: '../fonts/Newsreader-Accent.woff2',
  variable: '--f-accent',
  weight: '300 500',
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'serif'],
});
/* The name in ice is drawn on a canvas from this face. A static instance
   (weight 800) so the canvas and the DOM agree in every browser. Only the
   home page sets anything in it, so it is not preloaded from here (that
   would fetch it on every page): the home page's own slot asks for it
   ahead of time (src/app/@ice/page.tsx). */
const ice = localFont({
  src: '../fonts/TASAOrbiter-Ice.woff2',
  variable: '--f-ice',
  weight: '800',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': '/feed.xml' },
  },
  openGraph: {
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    creator: '@aravhawk',
    site: '@aravhawk',
  },
};

/* Structured data: who this is and which address is the real one. */
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.page.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.page.dark },
  ],
};

/* Runs before first paint: the stored theme or the system's, so the wrong
   theme never flashes. It also says that scripts run here at all: without
   that mark the home page lays itself out as a plain page. */
const boot = `(function(){var d=document.documentElement;d.setAttribute('data-scripted','');try{var s=localStorage.getItem('theme');var k=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;d.dataset.theme=k?'dark':'light'}catch(e){d.dataset.theme='light'}})()`;

const fontVars = [orbiter, mono, accent, ice].map((f) => f.variable).join(' ');

export default function RootLayout({ children, ice: iceSlot }: { children: React.ReactNode; ice: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {/* The nav. The pages that fly bring their own runtime with it; no other page loads one. */}
        <Chrome />
        <div className="shell">
          {/* Route changes: the old page lifts away, the new one settles in. */}
          <ViewTransition default="page">{children}</ViewTransition>
        </div>
        {iceSlot}
        {/* These endpoints exist only on Vercel; elsewhere they would 404. */}
        {process.env.VERCEL ? <Analytics /> : null}
        {process.env.VERCEL ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
