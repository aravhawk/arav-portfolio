'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { StageHandle } from '@/water/stage';

declare global {
  interface Window {
    __water?: StageHandle;
  }
}

/**
 * The world under the page. The engine is loaded after first paint, so the
 * static design is what loads and the water is what arrives. If WebGL2 or
 * float targets are missing, nothing mounts and the static design stays.
 */
export function WaterStage() {
  const root = useRef<HTMLDivElement>(null);
  const handle = useRef<StageHandle | null>(null);
  const pathname = usePathname();
  // The home page is the flight, with its own world and its own canvas: this one stays out.
  const away = pathname === '/';

  useEffect(() => {
    let cancelled = false;
    const el = root.current;
    if (!el || away) return;
    const start = () => {
      import('@/water/stage')
        .then(({ mountWater }) => mountWater(el, () => cancelled))
        .then((h) => {
          if (!h) return;
          if (cancelled) {
            h.destroy();
            return;
          }
          handle.current = h;
          window.__water = h;
        })
        .catch(() => {
          // No WebGL2 or no float targets: the static design stays.
          document.documentElement.dataset.water = 'off';
        });
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 600 })
      : window.setTimeout(start, 60);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      handle.current?.destroy();
      handle.current = null;
      delete window.__water;
    };
  }, [away]);

  // A new route is a new layout: carve the bed again.
  useEffect(() => {
    handle.current?.rebuild();
  }, [pathname]);

  return <div ref={root} className="water-root" aria-hidden="true" />;
}
