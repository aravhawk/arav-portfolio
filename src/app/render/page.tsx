import type { Metadata } from 'next';
import { FlightPage } from '@/components/flight/FlightPage';

/**
 * The renderer's route. It is the home page drawn by the live engine, and
 * it exists for one reader: tools/flight/render.mjs, which photographs the
 * flight's frames from it. Nothing on the site links here, it is not in the
 * sitemap, and robots are told to keep out (robots.ts, and below).
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Renderer',
  robots: { index: false, follow: false },
  alternates: { canonical: '/' },
};

export default function Render() {
  return <FlightPage live />;
}
