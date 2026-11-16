import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Nav } from '@/components/Nav';
import { Runtime } from '@/components/Runtime';
import { WaterStage } from '@/components/WaterStage';
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

const SITE = 'https://aravjain.dev';
const DESCRIPTION =
  'Arav Jain builds AI and developer tooling: Infiniview, agents that attack your app to prove what breaks, plus open source that developers run every day.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Arav Jain: AI and developer tooling builder', template: '%s · Arav Jain' },
  description: DESCRIPTION,
  authors: [{ name: 'Arav Jain', url: SITE }],
  openGraph: {
    title: 'Arav Jain: AI and developer tooling builder',
    description: DESCRIPTION,
    type: 'website',
    url: SITE,
    siteName: 'Arav Jain',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arav Jain: AI and developer tooling builder',
    description: DESCRIPTION,
    creator: '@aravhawk',
  },
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': '/feed.xml' },
  },
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

const fontVars = [martian, martianMono, tasa, spline, zalando, newsreader, sometype].map((f) => f.variable).join(' ');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <WaterStage />
        <Nav />
        <div className="shell">{children}</div>
        <Runtime />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
