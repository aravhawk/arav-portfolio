/**
 * A picture that is not asked for until the page has shown its first frame.
 *
 * `loading="lazy"` alone does not do that: a browser asks for a lazy picture
 * as soon as the page is laid out if it is within a few screens, which on
 * these pages is most of them, and they then share the line with the page's
 * own first picture and its fonts. So a held picture is written with its
 * address set aside (`data-src`, and `data-set` or `data-srcset`) and one clear pixel in its
 * place, and Runtime.tsx gives it its address at the page's first calm
 * moment (src/lib/calm.ts). From then on it is an ordinary lazy picture: the
 * browser fetches it when it is near, as before.
 *
 * The clear pixel keeps it a picture while it waits: it takes the size its
 * CSS and its `width` and `height` give it, so nothing moves when the real
 * one arrives. Without scripts, the `noscript` copy is the picture, at one
 * width.
 */
const CLEAR = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

type Props = Omit<React.ComponentProps<'img'>, 'src' | 'srcSet' | 'loading'> & { src: string; srcSet?: string };

/** One address for a reader without scripts: the width nearest 1080px. (A second copy of every width would double the page's HTML for everyone.) */
function plain(src: string, srcSet?: string) {
  const all = (srcSet ?? '').split(', ').map((entry) => ({ url: entry.split(' ')[0], w: parseInt(entry.split(' ')[1] ?? '', 10) })).filter((c) => c.url && c.w);
  return all.sort((x, y) => Math.abs(x.w - 1080) - Math.abs(y.w - 1080))[0]?.url ?? src;
}

/**
 * A picture's widths, said once. The optimiser's addresses for one picture differ only in their width, and a row of
 * the work index carried eight of them twice over (once in the page, once in the data the page is hydrated from): on
 * /work that was a quarter of the HTML, and it pushed the page past what a server sends in its first round. Where
 * every address has the one shape (`<base>&w=<width>&q=<quality> <width>w`), the page carries the base, the quality
 * and the widths (`data-set`), and Runtime.tsx writes the same list out again. Any other list is carried whole.
 */
export function pack(srcSet?: string) {
  const parts = (srcSet ?? '').split(', ').map((entry) => /^(.+)&w=(\d+)&q=(\d+) (\d+)w$/.exec(entry));
  const first = parts[0];
  if (!first || !parts.every((m) => m && m[1] === first[1] && m[3] === first[3] && m[2] === m[4])) return null;
  return `${first[1]}|${first[3]}|${parts.map((m) => m![2]).join(',')}`;
}
/** The list `pack` stands for. (Runtime.tsx has its own copy of these two lines: it must not load this file's server code.) */
export function unpack(set: string) {
  const [base, q, widths] = set.split('|');
  return widths.split(',').map((w) => `${base}&w=${w}&q=${q} ${w}w`).join(', ');
}

export function Held({ src, srcSet, alt = '', style, ...rest }: Props) {
  // (A picture's own shape wins over the shape its `width` and `height` suggest, and the clear pixel is square: so the
  // shape is said outright while it waits; Runtime.tsx takes it off again when the real picture has loaded. Where CSS
  // sets both of the picture's sides, as in a band or a row, this does nothing.)
  const shape = typeof rest.width === 'number' && typeof rest.height === 'number' ? { aspectRatio: `${rest.width} / ${rest.height}` } : null;
  rest = { ...rest, style: { ...shape, ...style } } as typeof rest;
  const set = pack(srcSet);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- the optimiser's own addresses, given to the picture late: see above */}
      <img {...rest} alt={alt} src={CLEAR} data-held="" data-src={src} data-set={set ?? undefined} data-srcset={set ? undefined : srcSet} loading="lazy" decoding="async" />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
        <img {...rest} alt={alt} src={plain(src, srcSet)} loading="lazy" decoding="async" />
      </noscript>
    </>
  );
}
