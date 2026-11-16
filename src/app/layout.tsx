import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ViewTransition } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Nav } from '@/components/Nav';
import { Runtime } from '@/components/Runtime';
import { WaterStage } from '@/components/WaterStage';
import { CONTACT } from '@/content/projects';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import './globals.css';

/* Type: see docs/redesign-v4/typography.md and font-licenses.md.
   All faces are SIL OFL 1.1 and self hosted from src/fonts. */
const martian = localFont({
  src: '../fonts/MartianGrotesk-VF.woff2',
  variable: '--f-martian',
  weight: '100 1000',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '75% 200%' }],
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});
const martianMono = localFont({
  src: '../fonts/MartianMono-VF.woff2',
  variable: '--f-martian-mono',
  weight: '100 800',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'Menlo', 'monospace'],
});
/* The name in ice is drawn on a canvas from this face. A static instance
   (width 112, weight 760) so the canvas and the DOM agree in every browser:
   canvas text cannot set variable axes. */
const ice = localFont({
  src: '../fonts/MartianGrotesk-Ice.woff2',
  variable: '--f-ice',
  weight: '760',
  display: 'swap',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});

/* Bake-off candidates. Only the pick stays in the final build. */
const tasa = localFont({ src: '../fonts/TASAOrbiter-VF.woff2', variable: '--f-tasa', weight: '400 800', display: 'swap', preload: false });
const spline = localFont({ src: '../fonts/SplineSansMono-VF.woff2', variable: '--f-spline', weight: '300 700', display: 'swap', preload: false });
const zalando = localFont({
  src: '../fonts/ZalandoSans-VF.woff2',
  variable: '--f-zalando',
  weight: '200 900',
  display: 'swap',
  preload: false,
  declarations: [{ prop: 'font-stretch', value: '75% 125%' }],
});
const newsreader = localFont({ src: '../fonts/Newsreader-VF.woff2', variable: '--f-newsreader', weight: '200 800', display: 'swap', preload: false });
const sometype = localFont({ src: '../fonts/SometypeMono-VF.woff2', variable: '--f-sometype', weight: '400 700', display: 'swap', preload: false });

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
    { media: '(prefers-color-scheme: light)', color: '#e4e7e8' },
    { media: '(prefers-color-scheme: dark)', color: '#15181b' },
  ],
};

/* Runs before first paint: the stored theme or the system's, so the wrong
   theme never flashes. The type switch is for the bake-off only. */
const boot = `(function(){var d=document.documentElement;try{var s=localStorage.getItem('theme');var k=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;d.dataset.theme=k?'dark':'light';var t=new URLSearchParams(location.search).get('type');if(t)d.dataset.type=t}catch(e){d.dataset.theme='light'}})()`;

const fontVars = [martian, martianMono, ice, tasa, spline, zalando, newsreader, sometype].map((f) => f.variable).join(' ');

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <WaterStage />
        <Nav />
        <div className="shell">
          {/* Route changes: the old page lifts away, the new one settles in.
              The water underneath is not part of the swap and keeps running. */}
          <ViewTransition default="page">{children}</ViewTransition>
        </div>
        <Runtime />
        {/* These endpoints exist only on Vercel; elsewhere they would 404. */}
        {process.env.VERCEL ? <Analytics /> : null}
        {process.env.VERCEL ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
