import type { Metadata } from 'next';
import { Instrument_Serif, Space_Grotesk, DM_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://aravjain.dev'),
  title: 'Arav Jain - Co-Founder, Infiniflop Labs',
  description: 'Co-Founder of Infiniflop Labs. Building AI agents that find issues in your apps before users do.',
  keywords: ['Infiniflop Labs', 'AI Agents', 'Arav Jain', 'Founder', 'Engineer'],
  authors: [{ name: 'Arav Jain' }],
  openGraph: {
    title: 'Arav Jain - Co-Founder, Infiniflop Labs',
    description: 'Co-Founder of Infiniflop Labs. Building AI agents that find issues in your apps before users do.',
    type: 'website',
    url: 'https://aravjain.dev',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arav Jain - Co-Founder, Infiniflop Labs',
    description: 'Co-Founder of Infiniflop Labs. Building AI agents that find issues in your apps before users do.',
    creator: '@aravhawk',
  },
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${instrumentSerif.variable} ${spaceGrotesk.variable} ${dmMono.variable}`} >
      <body className="bg-[#050505] text-[#FAFAFA] antialiased font-sans">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
