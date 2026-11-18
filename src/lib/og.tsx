import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * Open Graph cards: the site's own picture with the page's words set over
 * it. The pictures are photographed from the live home page by
 * scripts/capture-og.mjs (light theme, words hidden) into public/og, with
 * a manifest that says how light each one is where the words stand. The
 * home card is the first frame, the name cut through the lake's ice; every
 * other card is a station of the flight with its subject right of centre
 * and the words on the calm ground to the left. Set in the site's real
 * faces (static instances, in src/fonts/og).
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/png';

/** Which picture stands behind a card, and what it shows (for alt text). */
export const PICTURES = {
  home: 'The name Arav Jain stands as letters of pale glacier ice on a frozen lake swept to dark clear ice, mirrored in it, with snow-covered ranges under a low morning sun beyond.',
  infiniview: 'A rough block of clear ice holding the Infiniview card stands in a pool of teal meltwater, waves breaking at its foot, on a snowfield under far ranges.',
  'open-source': 'Seven meltwater streams of different widths fall over a cliff of ice into a teal river that winds away across a snowfield.',
  'kilo-bench': 'Benchmark results set as type on a dark slab on the bed of a clear rock pool, blocks of glacier ice standing in it, on a snowfield with a tarn beyond.',
  'agent-bridge': 'Two shards of pale ice stand in a still tarn, with a frozen lake and snow-covered ranges beyond.',
  ollama: 'Four pillars of clear glacier ice of different sizes stand in a pool of meltwater on a snowfield under far ranges.',
  'cc-switch': 'A dam of ice with three sluices holds back a dark pond; below it one channel runs white with meltwater and two lie dry.',
  tensorpow: 'Sixteen cubes of ice stand four by four in a pool of teal meltwater on a snowfield.',
  rydar: 'The RydAR page under a pane of clear ice in a wall of glacier ice, a cornice of snow and icicles over it, meltwater at its foot.',
  work: 'A meltwater river parts round snow-covered bars in a delta and runs out to a deep blue sea under a low sun.',
  blog: 'A still tarn with two shards of pale ice standing in it, a brook running from it across wind-cut snow to a rock pool with blocks of ice.',
} as const;
export type Picture = keyof typeof PICTURES;

/** A card's alt text: its words, then what is drawn. */
export const ogAlt = (words: string, picture: Picture) => `${words.replace(/[.\s]+$/, '')}. ${PICTURES[picture]}`;

const INK = '#0a0c0e';
const INK2 = '#262d31';
const PALE = '#f7fafb';
const PALE2 = '#dfe8ec';

type Tone = 'light' | 'dark';

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

/** The picture and its tone. Null when it has not been captured: the card falls back to a plain ground. */
async function loadPicture(name: Picture): Promise<{ src: string; tone: Tone } | null> {
  const dir = join(process.cwd(), 'public', 'og');
  try {
    const [jpg, manifest] = await Promise.all([readFile(join(dir, `${name}.jpg`)), readFile(join(dir, 'manifest.json'), 'utf8').catch(() => '{}')]);
    const tone = (JSON.parse(manifest) as Record<string, { tone?: Tone }>)[name]?.tone === 'dark' ? 'dark' : 'light';
    return { src: `data:image/jpeg;base64,${jpg.toString('base64')}`, tone };
  } catch {
    return null;
  }
}

export interface OgCard {
  /** Small mono label, e.g. "Infiniflop Labs". */
  kicker: string;
  title: string;
  line?: string;
  picture: Picture;
}

const full = { position: 'absolute' as const, left: 0, top: 0, width: 1200, height: 630 };

export async function renderOg({ kicker, title, line, picture }: OgCard) {
  const [data, pic] = await Promise.all([loadFonts(), loadPicture(picture)]);
  const tone: Tone = pic?.tone ?? 'light';
  const ink = tone === 'light' ? INK : PALE;
  const ink2 = tone === 'light' ? INK2 : PALE2;
  // The calm zone: the picture's own haze (or shade), deepest at the left
  // edge and gone before the subject. No edge, so it is never a box.
  const veil = tone === 'light' ? '240,245,248' : '6,18,28';
  const k = tone === 'light' ? 1 : 0.92;
  const shade = `linear-gradient(90deg, rgba(${veil},${0.9 * k}) 0%, rgba(${veil},${0.84 * k}) 30%, rgba(${veil},${0.6 * k}) 46%, rgba(${veil},${0.22 * k}) 60%, rgba(${veil},0) 72%)`;

  const ground = (
    <div style={{ ...full, display: 'flex', background: 'linear-gradient(135deg, #eef2f4 0%, #dfe7ec 45%, #c9d8e0 100%)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {pic ? <img src={pic.src} width={1200} height={630} alt="" style={{ ...full }} /> : null}
    </div>
  );

  const mono = { display: 'flex', fontFamily: 'Mono', fontSize: 19, letterSpacing: 2.6 } as const;

  let body;
  if (picture === 'home') {
    // The first frame as it is. The name is in the picture: only the line
    // and the address are set, on the near ice under it.
    body = (
      <div style={{ ...full, display: 'flex' }}>
        <div style={{ ...full, display: 'flex', background: 'radial-gradient(ellipse 560px 150px at 600px 548px, rgba(244,248,250,0.9) 0%, rgba(244,248,250,0.72) 45%, rgba(244,248,250,0) 100%)' }} />
        <div style={{ position: 'absolute', display: 'flex', left: 0, top: 496, width: 1200, justifyContent: 'center', fontFamily: 'Display', fontSize: 41, letterSpacing: 0.3, lineHeight: 1, color: INK }}>{line}</div>
        <div style={{ ...mono, position: 'absolute', left: 0, top: 562, width: 1200, justifyContent: 'center', color: INK2 }}>{kicker.toUpperCase()}</div>
      </div>
    );
  } else {
    const longest = Math.max(...title.split(/[\s]+/).map((w) => w.length));
    const size = title.length > 44 ? 50 : title.length > 26 ? 60 : title.length > 16 ? 76 : title.length > 11 || longest > 8 ? 92 : 112;
    body = (
      <div style={{ ...full, display: 'flex' }}>
        <div style={{ ...full, display: 'flex', background: shade }} />
        <div style={{ position: 'absolute', left: 64, top: 56, width: 610, height: 518, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ ...mono, color: ink2 }}>{kicker.toUpperCase()}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: 'Display', fontSize: size, letterSpacing: size * 0.004, lineHeight: size > 80 ? 1 : 1.08, color: ink }}>{title}</div>
            {line ? <div style={{ display: 'flex', marginTop: 24, maxWidth: 560, fontFamily: 'Text', fontSize: 29, lineHeight: 1.36, letterSpacing: 0.2, color: ink2 }}>{line}</div> : null}
          </div>
          <div style={{ ...mono, color: ink }}>ARAV.PRO</div>
        </div>
      </div>
    );
  }

  return new ImageResponse(
    (
      <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%' }}>
        {ground}
        {body}
      </div>
    ),
    { ...OG_SIZE, fonts: data },
  );
}
