'use client';

import { useEffect, useRef } from 'react';
import { stillVars } from '@/components/work/stills';
import { whenCalm } from '@/lib/calm';
import type { SceneId } from '@/water/scene-band';

interface Props {
  scene: SceneId;
  /** A shorter band: a post's head. */
  short?: boolean;
  /** A band that is the whole first screen: a page with nothing under it. */
  full?: boolean;
  /** An index page: a little lower, so the first row of the list stands in the first screen. */
  index?: boolean;
  /** What the stations carry (see scene-band.ts). */
  tribs?: number[];
  cols?: number[];
  slab?: string;
  sheet?: string;
  face?: string;
  /** The scene's still as a picture (BandStill): what the page paints first, under the canvas. */
  still: React.ReactNode;
  /** The page's label, title and line: they stand in the scene's calm corner. */
  children: React.ReactNode;
}

/**
 * The head of an inner page: a live frame of the home page's world with the
 * page's words standing in it. What loads is a still of that frame (one per
 * theme, and one for an upright screen), as a picture in the HTML; the
 * engine arrives after first paint and takes its place. Where the engine
 * cannot run, the still stays. The engine is not fetched until the page
 * has painted and the band is on or near the screen: a page opened part
 * way down does not start it.
 */
export function SceneBand({ scene, short, full, index, tribs, cols, slab, sheet, face, still, children }: Props) {
  const view = useRef<HTMLDivElement>(null);
  const tribKey = tribs?.join(',') ?? '';
  const colKey = cols?.map((c) => c.toFixed(1)).join(',') ?? '';

  useEffect(() => {
    const el = view.current;
    if (!el) return;
    let cancelled = false;
    let handle: { detach(): void } | null = null;
    const start = () => {
      import('@/water/scene-band')
        .then(({ attachBand }) =>
          attachBand(
            el,
            {
              scene,
              tribs: tribKey ? tribKey.split(',').map(Number) : undefined,
              cols: colKey ? colKey.split(',').map(Number) : undefined,
              slab,
              sheet,
              face,
            },
            () => cancelled,
          ),
        )
        .then((h) => {
          if (cancelled) h?.detach();
          else handle = h;
        })
        .catch((err) => {
          if (process.env.NODE_ENV !== 'production') console.warn(err);
        });
    };
    let offCalm = () => {};
    // The engine is some 180 kB of script. It is not asked for until the page has shown its first frame (the still
    // and the words) and is idle, so it never competes with them on a slow line (src/lib/calm.ts).
    const whenIdle = () => {
      if (!cancelled) offCalm = whenCalm(start);
    };
    // (Near: within half a screen. A band at the head of a page a reader has just opened is on it.)
    const near =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(
            (entries) => {
              if (!entries.some((e) => e.isIntersecting)) return;
              near?.disconnect();
              whenIdle();
            },
            { rootMargin: '50% 0px' },
          )
        : null;
    if (near) near.observe(el);
    else whenIdle();
    return () => {
      cancelled = true;
      near?.disconnect();
      offCalm();
      handle?.detach();
    };
  }, [scene, tribKey, colKey, slab, sheet, face]);

  return (
    <header className={`band${short ? ' band-short' : ''}${full ? ' band-full' : ''}${index ? ' band-index' : ''}`} data-scene-id={scene}>
      <div
        ref={view}
        className="band-view"
        data-fill
        aria-hidden="true"
        style={stillVars(scene)}
      >
        {still}
      </div>
      <div className="band-words wrap" data-band-words>
        {children}
      </div>
    </header>
  );
}
