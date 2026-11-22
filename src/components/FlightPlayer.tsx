'use client';

import { useEffect, useRef } from 'react';
import type { PlayerHandle } from '@/flight/player';
import type { Plan } from '@/flight/types';
import { mountSoundControl } from '@/lib/sound-control';

declare global {
  interface Window {
    __player?: PlayerHandle;
  }
}

const DIR = '/flight';
const TALL = '(max-aspect-ratio: 9/10)';
const DARK = '(prefers-color-scheme: dark)';
/** The wide still's widths. It covers the window: as wide as the window, or wider where the window is taller than 16:9. */
const WIDE_W = [1280, 1920, 2560];
const WIDE_SIZES = 'max(100vw, 178vh)';
const wide = (theme: string, type: string) => WIDE_W.map((w) => `${DIR}/wide-${theme}.poster-${w}.${type} ${w}w`).join(', ');

/**
 * The flight's picture on the home page: the first frame as a still, in the
 * HTML, and over it the canvas the pre-rendered flight is played into
 * (src/flight/player.ts, loaded after the first paint).
 *
 * The still is the page's largest paint. It is a picture with a source for
 * each window shape and each scheme, so the browser's scanner asks for the
 * one this window needs before any script has run, and it has its size, so
 * nothing moves when it arrives. A reader whose chosen theme is not the
 * system's gets the right still from the stylesheet instead (flight.css),
 * as the inner pages' bands do.
 */
export function FlightPlayer({ plan }: { plan: Plan }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let cancelled = false;
    let handle: PlayerHandle | null = null;
    const start = () => {
      import('@/flight/player')
        .then(({ mountPlayer }) => {
          if (cancelled) return;
          handle = mountPlayer(el, plan);
          window.__player = handle;
          // (The checks read where the page is here, as they did of the engine.)
          window.__flight = handle as unknown as Window['__flight'];
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
      delete window.__player;
      delete window.__flight;
    };
  }, [plan]);

  // The sound control in the nav (sound is on unless muted): its behaviour lives with the home page, the one page with sound.
  useEffect(mountSoundControl, []);

  return (
    <div ref={root} className="flight-root" aria-hidden="true">
      <picture>
        <source media={`${TALL} and ${DARK}`} type="image/avif" srcSet={`${DIR}/tall-night.poster.avif`} width={780} height={1688} />
        <source media={`${TALL} and ${DARK}`} type="image/webp" srcSet={`${DIR}/tall-night.poster.webp`} width={780} height={1688} />
        <source media={TALL} type="image/avif" srcSet={`${DIR}/tall-day.poster.avif`} width={780} height={1688} />
        <source media={TALL} type="image/webp" srcSet={`${DIR}/tall-day.poster.webp`} width={780} height={1688} />
        <source media={DARK} type="image/avif" srcSet={wide('night', 'avif')} sizes={WIDE_SIZES} width={2560} height={1440} />
        <source media={DARK} type="image/webp" srcSet={wide('night', 'webp')} sizes={WIDE_SIZES} width={2560} height={1440} />
        <source type="image/avif" srcSet={wide('day', 'avif')} sizes={WIDE_SIZES} width={2560} height={1440} />
        <img className="fl-poster-img" src={`${DIR}/wide-day.poster-1920.webp`} srcSet={wide('day', 'webp')} sizes={WIDE_SIZES} width={2560} height={1440} alt="" loading="eager" fetchPriority="high" decoding="sync" />
      </picture>
    </div>
  );
}
