import type { Metadata, Viewport } from 'next';
import { Archivo, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import World from '@/world/World';
import Shell from '@/components/shell/Shell';
import './globals.css';

const display = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-display', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

const title = 'Arav Jain';
const description = 'Co-founder of Infiniflop Labs. I build AI agents and the tools around them.';

export const metadata: Metadata = {
  metadataBase: new URL('https://aravjain.dev'),
  title: { default: title, template: '%s. Arav Jain' },
  description,
  authors: [{ name: 'Arav Jain' }],
  openGraph: { title, description, type: 'website', url: 'https://aravjain.dev', images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'ARAV written in lights standing on water before dawn' }] },
  twitter: { card: 'summary_large_image', title, description, creator: '@aravhawk', images: ['/og.jpg'] },
  alternates: { canonical: '/', types: { 'application/rss+xml': '/feed.xml' } },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#04070c', colorScheme: 'dark' };

/* Decide before first paint whether this visit gets the film or the stills. */
const boot = `(function(){var d=document.documentElement,ok=false;try{var q=new URLSearchParams(location.search);if(!q.has('static')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){var c=document.createElement('canvas');ok=!!c.getContext('webgl2')}}catch(e){}d.dataset.world=ok?'live':'static';if(!ok)d.dataset.loaded='1';try{history.scrollRestoration='manual'}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <World />
        <Shell>{children}</Shell>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
