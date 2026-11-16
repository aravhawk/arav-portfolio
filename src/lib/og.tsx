import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * Open Graph cards in the site's own language: the pale machined slab, one
 * deep pool with its terraces, the stream leaving it, and the real faces
 * (static instances of Martian Grotesk and Martian Mono, SIL OFL 1.1).
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/png';

const LAND = '#e4e7e8';
const INK = '#0a0c0e';
const INK2 = '#3a4145';

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

/** A pool: concentric terraces stepping down into deep water. */
function Pool({ w, h, r, children }: { w: number; h: number; r: number; children?: React.ReactNode }) {
  const steps = [
    { inset: 0, fill: '#5fa9c0' },
    { inset: 12, fill: '#2f7f9c' },
    { inset: 28, fill: '#196685' },
    { inset: 48, fill: '#0f5371' },
  ];
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: w,
        height: h,
        borderRadius: r,
        // The chamfer: a light lip toward the key light, a shadow away from it.
        boxShadow: '-2px -2px 0 rgba(10,20,26,0.28), 3px 3px 0 rgba(255,255,255,0.9)',
      }}
    >
      {steps.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            display: 'flex',
            left: s.inset,
            top: s.inset,
            width: w - s.inset * 2,
            height: h - s.inset * 2,
            borderRadius: Math.max(6, r - s.inset),
            background: s.fill,
            boxShadow: 'inset 2px 2px 0 rgba(4,20,30,0.3)',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: 0,
          top: 0,
          width: w,
          height: h,
          borderRadius: r,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 38%, rgba(3,20,32,0.22) 100%)',
        }}
      />
      {children}
    </div>
  );
}

export interface OgCard {
  /** Small mono label, e.g. "01 / Infiniflop Labs". */
  kicker: string;
  title: string;
  line?: string;
  /** `home` casts the title in ice inside the pool. */
  variant?: 'home' | 'page';
}

export async function renderOg({ kicker, title, line, variant = 'page' }: OgCard) {
  const data = await loadFonts();
  const long = title.length > 34;
  const longest = Math.max(...title.split(' ').map((w) => w.length));
  const titleSize = variant === 'home' ? 150 : long ? 60 : title.length > 14 ? 88 : longest > 8 ? 108 : 124;

  const body =
    variant === 'home' ? (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '54px 56px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 96 }}>
          <div style={{ display: 'flex', fontFamily: 'Display', fontSize: 40, letterSpacing: -1.6, lineHeight: 1, color: INK }}>{line}</div>
          <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 18, letterSpacing: 1.4, color: INK2 }}>{kicker.toUpperCase()}</div>
        </div>
        <div style={{ display: 'flex', marginTop: 34 }}>
          <Pool w={1088} h={520} r={48}>
            <div
              style={{
                position: 'absolute',
                display: 'flex',
                left: 0,
                top: 118,
                width: 1088,
                justifyContent: 'center',
                fontFamily: 'Display',
                fontSize: titleSize,
                letterSpacing: -7,
                lineHeight: 1,
                color: '#f1f8fb',
                textShadow: '0 2px 0 rgba(255,255,255,0.7), 6px 10px 18px rgba(2,22,34,0.55)',
              }}
            >
              {title}
            </div>
          </Pool>
        </div>
      </div>
    ) : (
      <div style={{ display: 'flex', width: '100%', height: '100%', padding: '56px 0 56px 56px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 690, height: '100%' }}>
          <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 19, letterSpacing: 1.5, color: INK2 }}>{kicker.toUpperCase()}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Display',
                fontSize: titleSize,
                letterSpacing: titleSize * -0.045,
                lineHeight: long ? 1.02 : 0.92,
                color: INK,
              }}
            >
              {title}
            </div>
            {line ? (
              <div style={{ display: 'flex', marginTop: 26, maxWidth: 620, fontFamily: 'Text', fontSize: 28, lineHeight: 1.32, letterSpacing: -0.3, color: INK2 }}>
                {line}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 19, letterSpacing: 1.5, color: INK }}>ARAV JAIN / ARAV.PRO</div>
        </div>
        {/* The stream comes in from the top, fills the pool, and runs on. */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 454, height: '100%', marginTop: -56 }}>
          <div style={{ display: 'flex', width: 44, height: 120, background: '#2f7f9c', boxShadow: '-2px 0 0 rgba(10,20,26,0.28), 3px 0 0 rgba(255,255,255,0.9)' }} />
          <Pool w={356} h={330} r={40} />
          <div style={{ display: 'flex', width: 44, height: 260, background: '#2f7f9c', boxShadow: '-2px 0 0 rgba(10,20,26,0.28), 3px 0 0 rgba(255,255,255,0.9)' }} />
        </div>
      </div>
    );

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: `linear-gradient(135deg, #eef0f1 0%, ${LAND} 45%, #d6dadc 100%)`,
        }}
      >
        {body}
      </div>
    ),
    { ...OG_SIZE, fonts: data },
  );
}
