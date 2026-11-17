'use client';

import { useEffect, useRef } from 'react';
import { stillVars } from '@/components/work/stills';
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
  /** The page's label, title and line: they stand in the scene's calm corner. */
  children: React.ReactNode;
}

/**
 * The head of an inner page: a live frame of the home page's world with the
 * page's words standing in it. What loads is a still of that frame (one per
 * theme, and one for an upright screen); the engine arrives after first
 * paint and takes its place. Where the engine cannot run, the still stays.
 */
export function SceneBand({ scene, short, full, index, tribs, cols, slab, sheet, face, children }: Props) {
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
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 500 }) : window.setTimeout(start, 40);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      handle?.detach();
    };
  }, [scene, tribKey, colKey, slab, sheet, face]);

  return (
    <header className={`band${short ? ' band-short' : ''}${full ? ' band-full' : ''}${index ? ' band-index' : ''}`} data-scene-id={scene}>
      <div
        ref={view}
        className="band-view"
        aria-hidden="true"
        style={stillVars(scene)}
      />
      <div className="band-words wrap" data-band-words>
        {children}
      </div>
    </header>
  );
}
