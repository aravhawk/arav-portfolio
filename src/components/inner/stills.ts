/**
 * The picture at the head of a project's page: a still of that project's
 * scene on the home page, one for the day and one for the night. They are
 * photographed from the renderer itself, mid push, by tools/site/stills.cjs
 * (a band 2432 wide with a copy 1216 wide beside it). On a phone the page
 * opens as its scene does on the home page: the scene's tall still fills the
 * first screen and the title block stands on its calm ground (the same files
 * the home page's sections use, see src/scene/stills.ts).
 *
 * To add one when a scene lands: add its name to that tool, run it, and add
 * the slug here with a sentence that says what the picture shows.
 */
export interface Still {
  /** Each a pair of files: the full size, and one half as wide for a small screen (`-1216` before the extension). */
  day: string;
  night: string;
  /** The scene's tall frame, for a phone's first screen. */
  tallDay: string;
  tallNight: string;
  /** The full size file's pixels. */
  w: number;
  h: number;
  alt: string;
}

const ALT: Record<string, string> = {
  infiniview: 'A wall of pale slab ice on a snowfield with one slab fallen out of it, lying across a pool of black meltwater, a low sun behind.',
  'open-source': 'Seven narrow meltwater channels cross a snowfield and join one river that runs toward the viewer, under a low sun.',
  'kilo-bench': 'Three slabs of pale ice of different heights stand side by side at the edge of a meltwater river on a snowfield.',
  'agent-bridge': 'Two posts of ice stand on either bank of a meltwater river with a beam of ice laid across between them, a low sun behind.',
  ollama: 'Four round pools of meltwater lie in a line across a snowfield, each larger than the one behind it.',
  'cc-switch': 'A meltwater river on a snowfield parts into three branches at a fork; one runs open and bright, two lie frozen.',
  tensorpow: 'Sixteen blocks of ice stand in a grid on a round sheet of dark, mirror-smooth ice in a snowfield.',
  rydar: 'A single post of ice stands on the outside of a tight bend in a meltwater river on a snowfield.',
};

export const STILLS: Partial<Record<string, Still>> = Object.fromEntries(
  Object.entries(ALT).map(([slug, alt]) => [slug, { day: `/media/stills/${slug}-day.avif`, night: `/media/stills/${slug}-night.avif`, tallDay: `/media/stills/scene/${slug}-tall-day.avif`, tallNight: `/media/stills/scene/${slug}-tall-night.avif`, w: 2432, h: 1013, alt }]),
);

/** The two sizes of a still, for the browser's choice. */
export const stillSet = (src: string, w: number) => `${src.replace(/\.avif$/, '-1216.avif')} 1216w, ${src} ${w}w`;

export const stillOf = (slug: string): Still | undefined => STILLS[slug];
