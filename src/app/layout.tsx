import type { Metadata, Viewport } from 'next';
import { Onest, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Shell from '@/components/shell/Shell';
import './globals.css';

const onest = Onest({ subsets: ['latin'], variable: '--font-onest', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-jetbrains', display: 'swap' });

const title = 'Arav Jain. Co-founder, Infiniflop Labs';
const description = 'I build AI agents and dev tools. Co-founder of Infiniflop Labs, building Infiniview: agents that review, probe, and stress-test your code.';

export const metadata: Metadata = {
  metadataBase: new URL('https://aravjain.dev'),
  title,
  description,
  authors: [{ name: 'Arav Jain' }],
  openGraph: { title, description, type: 'website', url: 'https://aravjain.dev' },
  twitter: { card: 'summary_large_image', title, description, creator: '@aravhawk' },
  alternates: { canonical: '/', types: { 'application/rss+xml': '/feed.xml' } },
};

export const viewport: Viewport = {
  themeColor: '#ffd60a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${onest.variable} ${jetbrains.variable}`} data-ink="dark">
      <head>
        {/* Before first paint: tell the stylesheet whether the choreographed layout may apply. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.dataset.motion=matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'full'",
          }}
        />
      </head>
      <body>
        <Shell>{children}</Shell>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
