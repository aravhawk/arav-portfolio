import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  )
}
