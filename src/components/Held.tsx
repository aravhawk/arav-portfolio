/**
 * A picture that is not asked for until the page has shown its first frame.
 *
 * `loading="lazy"` alone does not do that: a browser asks for a lazy picture
 * as soon as the page is laid out if it is within a few screens, which on
 * these pages is most of them, and they then share the line with the page's
 * own first picture and its fonts. So a held picture is written with its
 * address set aside (`data-src`, `data-srcset`) and one clear pixel in its
 * place, and Runtime.tsx gives it its address after the page's first calm
 * moment (src/lib/calm.ts), when it comes within 600px of the viewport.
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

export function Held({ src, srcSet, alt = '', style, ...rest }: Props) {
  // (A picture's own shape wins over the shape its `width` and `height` suggest, and the clear pixel is square: so the
  // shape is said outright while it waits; Runtime.tsx takes it off again when the real picture has loaded. Where CSS
  // sets both of the picture's sides, as in a band or a row, this does nothing.)
  const shape = typeof rest.width === 'number' && typeof rest.height === 'number' ? { aspectRatio: `${rest.width} / ${rest.height}` } : null;
  rest = { ...rest, style: { ...shape, ...style } } as typeof rest;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- the optimiser's own addresses, given to the picture late: see above */}
      <img {...rest} alt={alt} src={CLEAR} data-held="" data-src={src} data-srcset={srcSet} loading="lazy" decoding="async" />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
        <img {...rest} alt={alt} src={plain(src, srcSet)} loading="lazy" decoding="async" />
      </noscript>
    </>
  );
}
