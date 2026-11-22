import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ViewTransition } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Nav } from '@/components/Nav';
import { Runtime } from '@/components/Runtime';
import { WaterStage } from '@/components/WaterStage';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, THEME_COLOR } from '@/lib/site';
import './globals.css';

/* Type: see docs/redesign-v4/typography.md and font-licenses.md.
   All faces are SIL OFL 1.1 and self hosted from src/fonts.

   The display face and the mono are each two files. The one named here is
   the Latin cut: every character the site sets today, with the whole
   weight axis and the same metrics, about 26 kB each. The whole font
   (`-VF`, 53 and 59 kB) is declared in globals.css as a second face with
   a `unicode-range` of everything the cut leaves out, so a browser fetches
   it only when a page really sets such a character (a name with a caron,
   say), and the page is still set in the same face. `scripts/font-cuts.sh`
   makes the cuts; `tests/content/fonts.test.ts` fails if the site's own
   text uses a character outside them. */
const orbiter = localFont({
  src: '../fonts/TASAOrbiter-Latin.woff2',
  variable: '--f-orbiter',
  weight: '400 800',
  display: 'swap',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});
/* (Preloaded: the first screen of every inner page sets its label or its way back in it.) */
const mono = localFont({
  src: '../fonts/SplineSansMono-Latin.woff2',
  variable: '--f-spline',
  weight: '300 700',
  display: 'swap',
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
/* The name's face: a static instance (weight 800) of the display face.
   Only the home page's heading is set in it, and that heading is clipped
   to a pixel wherever the picture is drawn (it shows in print and in
   forced colours). So it is not preloaded: preloaded from here it was
   fetched at high priority by every page on the site, 31 kB that no inner
   page sets a letter in. A browser now fetches it only where the heading
   is really shown. (The name in the picture is cut from the display
   face's own heaviest weight, not from this file: see buildName in
   flight.ts. And a preload cannot be kept for one route: the font
   manifest lists a preloaded file for all of them.) */
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
   that mark the home page lays itself out as a plain page.

   And the sound's choice, so its control is drawn in its true state in the
   first paint: on, unless the reader muted it before (it stays muted until
   they turn it on); or, where they have never chosen, unless the system asks
   for less data (Save-Data, prefers-reduced-data) or the device says it has
   a gigabyte of memory or less. */
const boot = `(function(){history.scrollRestoration='manual';function top(){if(!location.hash)scrollTo({top:0,behavior:'instant'})}top();addEventListener('pageshow',top);var d=document.documentElement;d.setAttribute('data-scripted','');try{var s=localStorage.getItem('theme');var k=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;d.dataset.theme=k?'dark':'light'}catch(e){d.dataset.theme='light'}var n=navigator,o='on';try{var m=localStorage.getItem('sound');if(m=='off'||m!='on'&&((n.connection||0).saveData||n.deviceMemory<=1||matchMedia('(prefers-reduced-data:reduce)').matches))o='off'}catch(e){}d.dataset.sound=o})()`;

const fontVars = [orbiter, mono, accent, ice].map((f) => f.variable).join(' ');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        {/* The sound's first gesture, before hydration: public/sound-gesture.js (a file of its own, so it is not in every page's HTML). */}
        <script async src="/sound-gesture.js" />
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
