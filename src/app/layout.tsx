import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { WaterStage } from '@/components/WaterStage';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://aravjain.dev'),
  title: 'Arav Jain',
  description: 'AI and developer tooling builder.',
};

const themeScript = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <WaterStage />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
