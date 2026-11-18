import Link from 'next/link';
import { ViewTransition } from 'react';
import { Arrow } from '@/components/bits';
import type { SceneId } from '@/water/scene-band';

/**
 * The way on, as a place. A page ends by returning to the world: a band of
 * the next page's own scene, the whole of it the link, with that page's
 * name standing in the picture's calm corner exactly as it will stand at
 * the head of the page it opens (so the name travels there in place).
 *
 * The pictures are photographs of the scene as it is drawn, taken with the
 * words' calm in them (public/media/scenes/<scene>-band-*.webp, made by
 * .tools/out/r3g/stills.js): one for each theme, a wide one and an upright
 * one. Only the one in use is fetched, and not until it is near the screen.
 */

const WIDE = { w: 2880, h: 1200 };
const TALL = { w: 1170, h: 1440 };

export function NextBand({
  scene,
  href,
  label,
  title,
  line,
  vt,
  aria,
}: {
  scene: SceneId;
  href: string;
  /** The small word over the name: "Next", or the part of the site the band opens. */
  label: string;
  title: string;
  line: string;
  /** Shared-element name: the title travels into the head of the page it opens. */
  vt?: string;
  aria: string;
}) {
  const name = <span className="display band-title next-title">{title}</span>;
  const pic = (shape: 'band' | 'bandtall', theme: 'light' | 'dark', size: { w: number; h: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- four fixed files, one shown: the optimiser's srcset would fetch a second size of each
    <img className={`next-pic next-${shape} next-${theme}`} src={`/media/scenes/${scene}-${shape}-${theme}.webp`} width={size.w} height={size.h} alt="" loading="lazy" decoding="async" />
  );
  return (
    <nav className="next" aria-label={aria}>
      <Link className="next-link" href={href}>
        <span className="next-view" data-fill aria-hidden="true">
          {pic('band', 'light', WIDE)}
          {pic('band', 'dark', WIDE)}
          {pic('bandtall', 'light', TALL)}
          {pic('bandtall', 'dark', TALL)}
        </span>
        <span className="next-words wrap">
          <span className="label next-label">
            {label} <Arrow />
          </span>
          {vt ? (
            <ViewTransition name={vt} share="title" default="none">
              {name}
            </ViewTransition>
          ) : (
            name
          )}
          <span className="lead band-lead next-line">{line}</span>
        </span>
      </Link>
    </nav>
  );
}

type Way = React.ComponentProps<typeof NextBand>;

/**
 * The two ways on that are not a project. A band is a picture of the place
 * it opens, under that place's own name: the tarn is the writing, the
 * delta is the work.
 */
export const WAY_TO_WRITING: Way = {
  scene: 'lake',
  href: '/blog',
  label: 'Writing',
  title: 'Notes from the work',
  line: 'What I learn building agents and the tools around them.',
  aria: 'Writing',
};
export const WAY_TO_WORK: Way = {
  scene: 'delta',
  href: '/work',
  label: 'Work',
  title: 'Everything I have built',
  line: 'Eight things I would point you to first, then the rest, one line each.',
  aria: 'Work',
};
