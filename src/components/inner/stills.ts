/**
 * The picture at the head of a project's page: a still of that project's
 * station in the home page's new scenes, one for the day and one for the
 * night. A project whose station is not built yet has none, and its page
 * opens on type alone.
 *
 * To add one when a station lands: put the two files in public/media/stills
 * (AVIF, the same size and crop as each other, each with a copy 1216 wide), and add the slug here with
 * the files' pixel size and a sentence that says what the picture shows.
 */
export interface Still {
  /** Each a pair of files: the full size, and one half as wide for a small screen (`-1216` before the extension). */
  day: string;
  night: string;
  /** The full size file's pixels. */
  w: number;
  h: number;
  alt: string;
}

export const STILLS: Partial<Record<string, Still>> = {
  infiniview: {
    day: '/media/stills/infiniview-day.avif',
    night: '/media/stills/infiniview-night.avif',
    w: 2432,
    h: 1013,
    alt: 'A wall of pale slab ice on a snowfield with one slab fallen out of it, lying across a pool of black meltwater, a low sun behind.',
  },
};

/** The two sizes of a still, for the browser's choice. */
export const stillSet = (src: string, w: number) => `${src.replace(/\.avif$/, '-1216.avif')} 1216w, ${src} ${w}w`;

export const stillOf = (slug: string): Still | undefined => STILLS[slug];
