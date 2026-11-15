import type { Metadata, Viewport } from 'next';
import { Archivo, Geist_Mono } from 'next/font/google';
import { ViewTransition } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import StageRoot from '@/components/StageRoot';
import Nav from '@/components/Nav';
import './globals.css';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

const description = 'Arav Jain builds Infiniview, AI agents and open source. 18,284 Ollama pulls, 9,819 npm downloads, 20 pull requests merged upstream.';

export const metadata: Metadata = {
  metadataBase: new URL('https://aravjain.dev'),
  title: { default: 'Arav Jain', template: '%s · Arav Jain' },
  description,
  authors: [{ name: 'Arav Jain' }],
  openGraph: { title: 'Arav Jain', description, type: 'website', url: 'https://aravjain.dev', siteName: 'Arav Jain' },
  twitter: { card: 'summary_large_image', title: 'Arav Jain', description, creator: '@aravhawk' },
  alternates: { canonical: '/', types: { 'application/rss+xml': '/feed.xml' } },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [{ color: '#e8ecef' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-tone="light" data-ground="cloud" className={`${archivo.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <StageRoot />
        <Nav />
        <main id="main" tabIndex={-1}>
          <ViewTransition default="page">{children}</ViewTransition>
        </main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
