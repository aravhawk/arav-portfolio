'use client';

import { useEffect, useRef } from 'react';
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
export function FlightStage({ slab }: { slab: string }) {
  const root = useRef<HTMLDivElement>(null);

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

  return <div ref={root} className="flight-root" data-slab={slab} aria-hidden="true" />;
}
