'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { StageHandle } from '@/water/stage';

declare global {
  interface Window {
    __water?: StageHandle;
  }
}

/**
 * The world's keeper between pages. Every inner page opens on a band of the
 * home page's world (SceneBand), all of them drawn by one engine that is
 * handed from page to page. The home page is the flight and runs its own:
 * when it opens, the inner pages' engine is let go at once, so the two
 * never draw together.
 */
export function WaterStage() {
  const pathname = usePathname();
  const home = pathname === '/';

  useEffect(() => {
    // (Nothing to let go unless a band has run on this visit.)
    if (!home || !window.__band) return;
    let cancelled = false;
    void import('@/water/scene-band').then(({ dropBand }) => {
      if (!cancelled) dropBand();
    });
    return () => {
      cancelled = true;
    };
  }, [home]);

  return null;
}
