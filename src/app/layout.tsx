import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arav Jain - Co-Founder, Infiniflop Labs',
  description: 'Co-Founder of Infiniflop Labs. Building AI agents that find issues in your apps before users do.',
  keywords: ['Infiniflop Labs', 'AI Agents', 'Arav Jain', 'Founder', 'Engineer'],
  authors: [{ name: 'Arav Jain' }],
  openGraph: {
    title: 'Arav Jain - Co-Founder, Infiniflop Labs',
    description: 'Co-Founder of Infiniflop Labs. Building AI agents that find issues in your apps before users do.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arav Jain - Co-Founder, Infiniflop Labs',
    description: 'Co-Founder of Infiniflop Labs. Building AI agents that find issues in your apps before users do.',
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
