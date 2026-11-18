'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { pickPoster } from '@/water/poster';
import type { FlightHandle } from '@/water/flight';

declare global {
  interface Window {
    __flight?: FlightHandle;
  }
}

/**
 * The flight's world: one fixed canvas behind the page. Loaded after first
 * paint, like the page's water. If WebGL2 or float targets are missing,
 * nothing mounts and the sections stack as a plain page.
 */
export function FlightStage({ slab, sheet, tribs, cols, face }: { slab: string; sheet: string; tribs: string; cols: string; face: string }) {
  const root = useRef<HTMLDivElement>(null);

  // The first paint's still. The page's own first script chooses it on a fresh load; coming here from another page
  // nothing has, so it is chosen now, before the paint. It follows the theme for as long as it may be seen.
  useLayoutEffect(() => {
    pickPoster();
    window.addEventListener('themechange', pickPoster);
    window.addEventListener('resize', pickPoster);
    return () => {
      window.removeEventListener('themechange', pickPoster);
      window.removeEventListener('resize', pickPoster);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let handle: FlightHandle | null = null;
    const el = root.current;
    if (!el) return;
    const start = () => {
      import('@/water/flight')
        .then(({ mountFlight }) => mountFlight(el, () => cancelled))
        .then((h) => {
          if (!h) return;
          if (cancelled) {
            h.destroy();
            return;
          }
          handle = h;
          window.__flight = h;
          // The checks and the capture tools read the engine here on every page.
          window.__water = h as unknown as Window['__water'];
        })
        .catch((err) => {
          if (process.env.NODE_ENV !== 'production') console.warn(err);
          document.documentElement.dataset.flight = 'off';
        });
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 600 }) : window.setTimeout(start, 60);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      handle?.destroy();
      delete window.__flight;
      delete window.__water;
      delete document.documentElement.dataset.flight;
    };
  }, []);

  return (
    <div ref={root} className="flight-root" data-slab={slab} data-sheet={sheet} data-tribs={tribs} data-cols={cols} data-face={face} aria-hidden="true">
      {/* The first paint: a still of the scene's own first frame, under the canvas (see flight.css). */}
      <div className="fl-poster" />
    </div>
  );
}
