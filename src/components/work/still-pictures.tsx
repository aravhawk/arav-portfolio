import { getImageProps } from 'next/image';

/**
 * The scenes' committed stills (public/media/scenes) as pictures: each is
 * served at the size it is shown, as AVIF or WebP, through the image
 * optimiser. A still is a photograph of the scene, so nothing about it is
 * redrawn here: only the file that reaches the reader is smaller.
 *
 *  - BandStill: the head of an inner page. It is the page's largest paint,
 *    so it is in the HTML, asked for first, and never lazy.
 *  - FeatStill: a project's picture in the work index. Lazy.
 *  - nextPic: the way on, at the foot of a page. Lazy.
 */

type Shape = 'wide' | 'tall' | 'band' | 'bandtall';
type Theme = 'light' | 'dark';

/** The stills' own sizes in pixels. A wide or upright still that is not the common size says so. */
const SIZE: Record<Shape, { w: number; h: number }> = {
  wide: { w: 2400, h: 1202 },
  tall: { w: 780, h: 1318 },
  band: { w: 2880, h: 1200 },
  bandtall: { w: 1170, h: 1440 },
};
const OWN: Record<string, Partial<Record<Shape, { w: number; h: number }>>> = {
  delta: { wide: { w: 2400, h: 792 } },
  lake: { wide: { w: 2400, h: 792 } },
  snow: { wide: { w: 2400, h: 1464 }, tall: { w: 780, h: 1688 } },
};

/** One of next.config.ts's `images.qualities`. At the default (75) the snow's grain and the ice's strata are smoothed away. */
const STILL_QUALITY = 90;

export const stillSize = (scene: string, shape: Shape) => OWN[scene]?.[shape] ?? SIZE[shape];
export const stillSrc = (scene: string, shape: Shape, theme: Theme) => `/media/scenes/${scene}-${shape}-${theme}.webp`;

/**
 * A still's widths. The optimiser offers every width it knows; a still needs
 * the ones from the smallest it is shown at (`from`) to the first that holds
 * the whole file (a wider one would be the same picture under another
 * address), or to `upTo` where it is never shown larger.
 */
function still(scene: string, shape: Shape, theme: Theme, sizes: string, from = 640, upTo = Infinity) {
  const { w, h } = stillSize(scene, shape);
  const { props } = getImageProps({ src: stillSrc(scene, shape, theme), alt: '', width: w, height: h, sizes, quality: STILL_QUALITY });
  const all = (props.srcSet ?? '').split(', ').map((entry) => ({ entry, w: parseInt(entry.split(' ')[1] ?? '0', 10) }));
  const whole = all.find((c) => c.w >= w)?.w ?? Infinity;
  const kept = all.filter((c) => c.w >= from && c.w <= Math.min(whole, upTo));
  return { src: kept[kept.length - 1]?.entry.split(' ')[0] ?? props.src, srcSet: kept.map((c) => c.entry).join(', '), sizes, width: w, height: h };
}

/** The band's height as a share of the screen's (pages.css: .band, .band-short, .band-index, .band-full). */
const BAND_SHARE = { page: 82, short: 62, index: 54, full: 100 };
export type BandKind = keyof typeof BAND_SHARE;

/* The picture is chosen by the screen's shape and by the system's scheme.
   The page's theme is the system's unless the reader has set one; where
   they differ, pages.css hides this picture and sets the right still. */
const UPRIGHT = '(max-aspect-ratio: 9/10)';
const WIDE = '(min-aspect-ratio: 9001/10000)';
const DARK = '(prefers-color-scheme: dark)';
const LIGHT = '(prefers-color-scheme: light)';

/**
 * The still at the head of a page. It covers the band, so it is as wide as
 * the screen, or wider where the band is taller than the picture's shape.
 */
export function BandStill({ scene, kind = 'page' }: { scene: string; kind?: BandKind }) {
  const share = BAND_SHARE[kind];
  const cover = (shape: Shape) => {
    const { w, h } = stillSize(scene, shape);
    return `max(${Math.ceil((share * w) / h)}vh, 100vw)`;
  };
  const wideSizes = cover('wide');
  const tallSizes = cover('tall');
  const wl = still(scene, 'wide', 'light', wideSizes);
  const wd = still(scene, 'wide', 'dark', wideSizes);
  const tl = still(scene, 'tall', 'light', tallSizes);
  const td = still(scene, 'tall', 'dark', tallSizes);
  // One of the four is the page's largest paint: each is preloaded for the screens that will show it, and only there.
  // The picture is in the first bytes of the page's HTML with `fetchpriority="high"`, so the browser's scanner asks
  // for it before any style or script is read. There is deliberately no <link rel="preload"> and no react-dom
  // preload(): React carries either as a hint in the data a <Link> prefetches, so every page that links here
  // fetched this still at high priority beside its own (measured: it cost a phone two seconds of largest paint).
  return (
    <>
      <picture>
        <source media={`${UPRIGHT} and ${DARK}`} srcSet={td.srcSet} sizes={td.sizes} width={td.width} height={td.height} />
        <source media={UPRIGHT} srcSet={tl.srcSet} sizes={tl.sizes} width={tl.width} height={tl.height} />
        <source media={DARK} srcSet={wd.srcSet} sizes={wd.sizes} width={wd.width} height={wd.height} />
        <img className="band-still" src={wl.src} srcSet={wl.srcSet} sizes={wl.sizes} width={wl.width} height={wl.height} alt="" loading="eager" fetchPriority="high" decoding="sync" />
      </picture>
    </>
  );
}

/** A row of the work index: on a phone the picture is as wide as the column, at a desk it is the row's second column. */
const FEAT_SIZES = '(max-width: 859px) 95vw, (max-width: 1680px) 27vw, 480px';

/** A project's picture in the work index, one for each theme: only the one shown is fetched, and not until it is near the screen. */
export function FeatStill({ scene }: { scene: string }) {
  const pic = (theme: Theme) => {
    const p = still(scene, 'wide', theme, FEAT_SIZES, 256, 1920);
    return (
      // eslint-disable-next-line @next/next/no-img-element -- two themes, one shown: see above
      <img className={`feat-still feat-${theme}`} src={p.src} srcSet={p.srcSet} sizes={p.sizes} width={p.width} height={p.height} alt="" loading="lazy" decoding="async" />
    );
  };
  return (
    <>
      {pic('light')}
      {pic('dark')}
    </>
  );
}

/* The way on (NextBand): a wide picture is 2.4 to 1 in a band at least 380px high, so it is never under 912px wide. */
const NEXT_SIZES = { band: 'max(100vw, 912px)', bandtall: '100vw' };

/** What a picture of the way on needs: its sizes and the widths it is served at. */
export function nextPic(scene: string, shape: 'band' | 'bandtall', theme: Theme) {
  return still(scene, shape, theme, NEXT_SIZES[shape]);
}
