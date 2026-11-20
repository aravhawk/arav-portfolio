import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * Open Graph cards. One design: the page's words at the lower left, as the
 * home page sets them, in the site's own faces (static instances, in
 * src/fonts/og). The home page's card and each project's stand on a still
 * of their scene, photographed from the renderer by tools/site/stills.cjs
 * into src/lib/og (the day, 1200 by 630, the words' corner on calm snow).
 * Writing and posts have no scene: their card is type on the page's own
 * ground.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/png';

/** Which scene stands behind a card, and what it shows (for alt text). */
export const PICTURES = {
  lake: 'The name Arav Jain stands as letters of pale ice at the edge of a frozen lake, dark open water beside it and snow-covered hills under a low sun beyond.',
  infiniview: 'A wall of pale slab ice on a snowfield with one slab fallen out of it, lying across a pool of black meltwater.',
  'open-source': 'Seven narrow meltwater channels cross a snowfield and join one river that runs toward the viewer.',
  'kilo-bench': 'Three slabs of pale ice of different heights stand side by side at the edge of a meltwater river.',
  'agent-bridge': 'Two posts of ice stand on either bank of a meltwater river with a beam of ice laid across between them.',
  ollama: 'Four round pools of meltwater lie in a line across a snowfield, each larger than the one behind it.',
  'cc-switch': 'A meltwater river on a snowfield parts into three branches at a fork.',
  tensorpow: 'Sixteen blocks of ice stand in a grid on a round sheet of dark, smooth ice in a snowfield.',
  rydar: 'A single post of ice stands on the outside of a tight bend in a meltwater river.',
  interests: 'A meltwater river fans out into seven channels where a snowfield meets open water.',
} as const;
export type Picture = keyof typeof PICTURES;

/** A card's alt text: its words, then what is drawn, if anything is. */
export const ogAlt = (words: string, picture?: Picture) => `${words.replace(/[.\s]+$/, '')}.${picture ? ` ${PICTURES[picture]}` : ''}`;

const INK = '#0a0c0e';
const INK2 = '#3a4145';
const LAND = '#e4e7e8';

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 500 | 700; style: 'normal' }[]> | null = null;
function loadFonts() {
  if (!fonts) {
    const dir = join(process.cwd(), 'src', 'fonts', 'og');
    fonts = Promise.all([
      readFile(join(dir, 'TASAOrbiter-Display.ttf')),
      readFile(join(dir, 'TASAOrbiter-Text.ttf')),
      readFile(join(dir, 'SplineSansMono-Label.ttf')),
    ]).then(([display, text, mono]) => [
      { name: 'Display', data: display, weight: 700 as const, style: 'normal' as const },
      { name: 'Text', data: text, weight: 400 as const, style: 'normal' as const },
      { name: 'Mono', data: mono, weight: 500 as const, style: 'normal' as const },
    ]);
  }
  return fonts;
}

const picture = async (name: Picture) => `data:image/jpeg;base64,${(await readFile(join(process.cwd(), 'src', 'lib', 'og', `${name}.jpg`))).toString('base64')}`;

export interface OgCard {
  /** The small line over the title: what the page is. */
  kicker: string;
  title: string;
  line?: string;
  /** The scene behind the words. Without one the card is type alone. */
  picture?: Picture;
}

const full = { position: 'absolute' as const, left: 0, top: 0, width: 1200, height: 630 };

export async function renderOg({ kicker, title, line, picture: name }: OgCard) {
  const [data, src] = await Promise.all([loadFonts(), name ? picture(name) : null]);
  // Where a scene keeps its subject on the left, the words take the narrower calm ground on the right.
  const narrow = name === 'kilo-bench';
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length));
  // On a scene the words keep to the calm ground at the lower left; on a plain card they have the width.
  const size = src
    ? title.length > 16 || narrow ? 58 : title.length > 10 || longest > 8 ? 68 : 92
    : title.length > 44 ? 58 : title.length > 26 ? 72 : 92;
  const mono = { display: 'flex', fontFamily: 'Mono', fontSize: 18, letterSpacing: 2.4 } as const;
  // The lake's card: the name is in the picture, so the title is not set again.
  const named = name === 'lake';
  const left = narrow ? 852 : 64;
  return new ImageResponse(
    (
      <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%', background: LAND }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} width={1200} height={630} alt="" style={{ ...full }} /> : null}
        {src ? null : <div style={{ position: 'absolute', left: 64, top: 96, width: 1072, height: 1, background: 'rgba(10,12,14,0.16)' }} />}
        <div style={{ ...mono, position: 'absolute', left: 64, top: 56, color: INK2 }}>ARAV.PRO</div>
        <div style={{ position: 'absolute', left, bottom: named ? 44 : 56, width: src ? (named ? 340 : narrow ? 330 : 470) : 1000, display: 'flex', flexDirection: 'column' }}>
          {named ? null : <div style={{ ...mono, color: INK2 }}>{kicker.toUpperCase()}</div>}
          {named ? null : <div style={{ display: 'flex', marginTop: 14, fontFamily: 'Display', fontSize: size, letterSpacing: size * -0.012, lineHeight: 1.02, color: INK }}>{title}</div>}
          {line ? <div style={{ display: 'flex', marginTop: named ? 12 : 20, maxWidth: src ? 440 : 820, fontFamily: named ? 'Display' : 'Text', fontSize: named ? 32 : 27, lineHeight: named ? 1.12 : 1.36, letterSpacing: named ? -0.5 : 0.1, color: named ? INK : INK2 }}>{line}</div> : null}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: data },
  );
}
