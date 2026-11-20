import Link from 'next/link';
import { ViewTransition } from 'react';
import { Arrow } from '@/components/bits';
import { nextPic } from '@/components/work/still-pictures';
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
 * one. Only the one in use is fetched, at the width it is shown, and not
 * until it is near the screen.
 */

export function NextBand({
  scene,
  href,
  label,
  title,
  line,
  vt,
  aria,
}: {
  /** The next page's scene. Without one the band is that page's words alone, on the snow. */
  scene?: SceneId;
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
  const pic = (shape: 'band' | 'bandtall', theme: 'light' | 'dark') => {
    const p = nextPic(scene ?? '', shape, theme);
    return (
      // eslint-disable-next-line @next/next/no-img-element -- four pictures, one shown (CSS picks the theme and the shape); each lazy, so only that one is fetched
      <img className={`next-pic next-${shape} next-${theme}`} src={p.src} srcSet={p.srcSet} sizes={p.sizes} width={p.width} height={p.height} alt="" loading="lazy" decoding="async" />
    );
  };
  return (
    <nav className={`next${scene ? '' : ' next-type'}`} aria-label={aria}>
      <Link className="next-link" href={href}>
        {scene ? (
          <span className="next-view" data-fill aria-hidden="true">
            {pic('band', 'light')}
            {pic('band', 'dark')}
            {pic('bandtall', 'light')}
            {pic('bandtall', 'dark')}
          </span>
        ) : null}
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
  line: 'Nine projects, in the order I would show them.',
  aria: 'Work',
};
