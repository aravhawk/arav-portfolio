import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arav Jain - AI Founder & Engineer',
  description: 'Founder & CEO of Infiniflop - Building the future of GPU compute infrastructure with pay-per-FLOP solutions.',
  keywords: ['AI', 'GPU', 'Machine Learning', 'Infiniflop', 'Arav Jain', 'Founder', 'Engineer'],
  authors: [{ name: 'Arav Jain' }],
  openGraph: {
    title: 'Arav Jain - AI Founder & Engineer',
    description: 'Building the future of GPU compute infrastructure.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arav Jain - AI Founder & Engineer',
    description: 'Building the future of GPU compute infrastructure.',
    creator: '@aravhawk',
  },
  alternates: {
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
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#050505] text-[#FAFAFA] antialiased font-sans">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
