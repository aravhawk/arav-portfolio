import type { Viewport } from 'next';
import { FlightPage } from '@/components/flight/FlightPage';
import { THEME_COLOR } from '@/lib/site';

/**
 * The home page: the flight, played from the frames rendered ahead of time
 * (see FlightPage and src/flight).
 */

// Live numbers are read on the server and cached for an hour. A visitor's
// page view never reaches GitHub, npm or Ollama.
export const revalidate = 3600;

// The browser's chrome takes the colour of the first frame's sky.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.home.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.home.dark },
  ],
};

export default function Home() {
  return <FlightPage />;
}
