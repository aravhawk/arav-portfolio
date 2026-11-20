import Image from 'next/image';
import type { ProjectMedia } from '@/content/projects';

/** The site's one arrow: onward, or out to another site. */
export function Arrow({ out = false }: { out?: boolean }) {
  return (
    <svg className="arrow" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      {out ? (
        <path d="M4 11 11 4M5.2 4H11v5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M2.5 7.5h10M8.4 3.4l4.1 4.1-4.1 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/**
 * How wide a picture is shown, for the browser's choice of file. The page's
 * column is 76rem at most, inside a gutter.
 */
export const FULL = '(max-width: 1280px) 92vw, 1216px';
export const HALF = '(max-width: 760px) 92vw, (max-width: 1280px) 46vw, 596px';
export const WIDE = '(max-width: 760px) 92vw, (max-width: 1280px) 60vw, 800px';

/**
 * A piece of real product media: the picture, a hairline round it, its
 * caption under it. `first` marks the one picture in a page's first screen:
 * it alone is fetched ahead of the rest.
 */
export function Shot({
  media,
  caption,
  sizes = FULL,
  first = false,
  className = '',
}: {
  media: ProjectMedia;
  caption?: React.ReactNode;
  sizes?: string;
  first?: boolean;
  className?: string;
}) {
  return (
    <figure className={`shot ${className}`}>
      <Image className="shot-media" src={media.src} alt={media.alt} width={media.w} height={media.h} sizes={sizes} preload={first} fetchPriority={first ? 'high' : undefined} decoding={first ? 'sync' : 'async'} />
      {caption ? <figcaption className="cap">{caption}</figcaption> : null}
    </figure>
  );
}

const fmt = new Intl.NumberFormat('en-US');

/**
 * A number read live from its public source: the value, set as a link to
 * where it was read, with when it was read beside it on hover or focus.
 * Rendered on the server at its final value; nothing moves.
 */
export function Live({ value, source, asOf, what }: { value: number; source: string; asOf: string; what: string }) {
  return (
    <a className="live" href={source} target="_blank" rel="noopener noreferrer" aria-label={`${fmt.format(value)} ${what}, as of ${asOf}. Opens the source.`}>
      <span aria-hidden="true">{fmt.format(value)}</span>
      <span className="live-tip metric-tip" aria-hidden="true">
        as of {asOf}
      </span>
    </a>
  );
}
