import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * Open Graph cards in the site's own language. The home card is the hero:
 * a pale sheet of lake ice with the name cut through it as deep water. Every
 * other card is lit stone with a stream of the page's water running down one
 * side. Set in the site's real faces (static instances, in src/fonts/og).
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

const r1 = (v: number) => Math.round(v * 10) / 10;
/** A fixed scatter: the same card every time it is drawn. */
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The frozen lake of the home page, seen from above: a pale sheet of ice
 * with windows of clear ice the wind has swept, pressure cracks that keep
 * clear of the name, and a lead of open water along the north shore.
 */
function Ice({ w, h }: { w: number; h: number }) {
  // Windows of clear ice: long shapes lying along the wind. None lies under
  // the name, so the letters are read against snow.
  const windows: { x: number; y: number; rx: number; ry: number; o: number }[] = [];
  for (let i = 0; i < 46; i++) {
    const x = rnd(i, 1) * w;
    const y = 30 + rnd(i, 2) * (h - 30);
    const nearName = x > 120 && x < w - 120 && y > h * 0.26 && y < h * 0.8;
    if (nearName && rnd(i, 5) < 0.8) continue;
    windows.push({ x: r1(x), y: r1(y), rx: r1(60 + rnd(i, 3) * 130), ry: r1(7 + rnd(i, 4) * 15), o: r1(0.35 + rnd(i, 6) * 0.4) });
  }
  // The shore: the sheet ends in an uneven edge a little way off the bank.
  let shore = `M0 ${h} L0 16`;
  for (let x = 0; x <= w; x += 24) shore += ` L${x} ${r1(15 + 5 * Math.sin(x / 61) + 3 * Math.sin(x / 23 + 1.3))}`;
  shore += ` L${w} ${h} Z`;
  const cracks = [
    `M-10 ${r1(h * 0.62)} C 60 ${r1(h * 0.66)}, 96 ${r1(h * 0.84)}, 132 ${h + 10}`,
    `M${w + 10} ${r1(h * 0.56)} C ${w - 70} ${r1(h * 0.64)}, ${w - 150} ${r1(h * 0.8)}, ${w - 236} ${r1(h * 0.86)} S ${w - 330} ${r1(h * 0.95)}, ${w - 350} ${h + 10}`,
    `M${w - 236} ${r1(h * 0.86)} C ${w - 190} ${r1(h * 0.93)}, ${w - 170} ${h}, ${w - 160} ${h + 10}`,
    `M170 16 C 230 ${r1(h * 0.16)}, 330 ${r1(h * 0.17)}, 400 16`,
    `M${w - 420} 16 C ${w - 360} ${r1(h * 0.2)}, ${w - 250} ${r1(h * 0.19)}, ${w - 190} 16`,
  ];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <linearGradient id="lead" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c4a5b" />
          <stop offset="1" stopColor="#2a93a6" />
        </linearGradient>
        <linearGradient id="sheet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6fbfc" />
          <stop offset="0.55" stopColor="#edf5f8" />
          <stop offset="1" stopColor="#dfecf1" />
        </linearGradient>
        <clipPath id="onice">
          <path d={shore} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={w} height="40" fill="url(#lead)" />
      <path d={shore} fill="url(#sheet)" />
      <g clipPath="url(#onice)">
        {windows.map((e, i) => (
          <g key={i} transform={`rotate(-17 ${e.x} ${e.y})`}>
            <ellipse cx={e.x} cy={e.y} rx={e.rx} ry={e.ry} fill={e.o > 0.6 ? '#8fc6d5' : e.o > 0.47 ? '#a9d4df' : '#c3e1e9'} />
            <ellipse cx={r1(e.x + e.rx * 0.62)} cy={r1(e.y + e.ry * 0.55)} rx={r1(e.rx * 0.6)} ry={r1(e.ry * 0.62)} fill={e.o > 0.6 ? '#8fc6d5' : e.o > 0.47 ? '#a9d4df' : '#c3e1e9'} />
            <ellipse cx={r1(e.x - e.rx * 0.7)} cy={r1(e.y - e.ry * 0.4)} rx={r1(e.rx * 0.45)} ry={r1(e.ry * 0.5)} fill={e.o > 0.6 ? '#8fc6d5' : e.o > 0.47 ? '#a9d4df' : '#c3e1e9'} />
          </g>
        ))}
        {cracks.map((d, i) => (
          <g key={i} fill="none" strokeLinecap="round">
            <path d={d} stroke="#ffffff" strokeWidth="5" />
            <path d={d} stroke="#8fb4c0" strokeWidth="1.3" />
          </g>
        ))}
      </g>
      <path d={shore} fill="none" stroke="#ffffff" strokeWidth="2" />
    </svg>
  );
}

/**
 * A stream of the page's water running down the card: curved banks that
 * widen and narrow, the far bank's shadow on the water, a lit edge on the
 * near one, and the net of light on its bed.
 */
function Stream({ w, h }: { w: number; h: number }) {
  const cx = (y: number) => w * 0.47 + 62 * Math.sin(y / 104 + 0.5) + 20 * Math.sin(y / 47 + 2.0);
  const hw = (y: number) => 58 + 20 * Math.sin(y / 150 + 2.2) + 7 * Math.sin(y / 39);
  let left = '';
  let right = '';
  for (let y = -20; y <= h + 20; y += 8) {
    left += `${left ? ' L' : 'M'}${r1(cx(y) - hw(y))} ${y}`;
    right = ` L${r1(cx(y) + hw(y))} ${y}` + right;
  }
  const d = `${left}${right} Z`;
  const net: string[] = [];
  for (let i = 0; i < 30; i++) {
    const y = 14 + i * 21 + rnd(i, 1) * 10;
    const x = cx(y) + (rnd(i, 2) - 0.5) * hw(y) * 1.3;
    const a = 16 + rnd(i, 3) * 22;
    const up = (rnd(i, 4) - 0.5) * 22;
    net.push(`M${r1(x - a)} ${r1(y)} q ${r1(a * 0.5)} ${r1(-9 + up * 0.4)} ${r1(a)} ${r1(up * 0.3)} t ${r1(a * 0.8)} ${r1(7 - up * 0.3)}`);
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3aa3b5" />
          <stop offset="0.5" stopColor="#23869b" />
          <stop offset="1" stopColor="#167088" />
        </linearGradient>
        <clipPath id="bed">
          <path d={d} />
        </clipPath>
      </defs>
      {/* The cut: shade on the bank away from the light, a lit arris toward it. */}
      <path d={d} fill="rgba(10,20,26,0.3)" transform="translate(-2.5 -2.5)" />
      <path d={d} fill="#ffffff" transform="translate(3 3)" />
      <path d={d} fill="#0b4657" />
      <g clipPath="url(#bed)">
        <path d={d} fill="#145f73" transform="translate(5 7)" />
        <path d={d} fill="url(#water)" transform="translate(11 15)" />
        {net.map((n, i) => (
          <path key={i} d={n} fill="none" stroke="#bdf0f7" strokeWidth={r1(1.4 + rnd(i, 7) * 2.6)} strokeLinecap="round" opacity={r1(0.18 + rnd(i, 8) * 0.34)} />
        ))}
      </g>
    </svg>
  );
}

export interface OgCard {
  /** Small mono label, e.g. "01 / Infiniflop Labs". */
  kicker: string;
  title: string;
  line?: string;
  /** `home` cuts the title through the lake's ice. */
  variant?: 'home' | 'page';
}

export async function renderOg({ kicker, title, line, variant = 'page' }: OgCard) {
  const data = await loadFonts();
  const long = title.length > 34;
  const longest = Math.max(...title.split(' ').map((w) => w.length));
  const titleSize = long ? 58 : title.length > 14 ? 84 : longest > 8 ? 104 : 120;

  const body =
    variant === 'home' ? (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 164, padding: '0 56px 30px' }}>
          <div style={{ display: 'flex', fontFamily: 'Display', fontSize: 42, letterSpacing: -0.4, lineHeight: 1, color: INK }}>{line}</div>
          <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 19, letterSpacing: 1.5, color: INK2 }}>{kicker}</div>
        </div>
        {/* The lake: the bank's shadow, the lead along the shore, the sheet. */}
        <div style={{ position: 'relative', display: 'flex', width: 1200, height: 466, boxShadow: '0 -2px 0 rgba(10,20,26,0.34)' }}>
          <Ice w={1200} h={466} />
          {/* The name is cut through the sheet: a lit lip below each letter,
              the far wall's shade above, and deep water in the cut. */}
          {[
            { dy: 3, style: { color: '#ffffff' } },
            { dy: -2, style: { color: 'rgba(8,44,56,0.5)' } },
            { dy: 0, style: { backgroundImage: 'linear-gradient(180deg, #083645 0%, #0b4c5e 26%, #14788c 70%, #1f93a6 100%)', backgroundClip: 'text', color: 'transparent' } },
          ].map((l, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                display: 'flex',
                left: 0,
                top: 128 + l.dy,
                width: 1200,
                justifyContent: 'center',
                fontFamily: 'Display',
                fontSize: 206,
                letterSpacing: -3,
                lineHeight: 1,
                ...l.style,
              }}
            >
              {title}
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div style={{ display: 'flex', width: '100%', height: '100%', padding: '56px 0 56px 56px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 720, height: '100%' }}>
          <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 19, letterSpacing: 1.5, color: INK2 }}>{kicker.toUpperCase()}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Display',
                fontSize: titleSize,
                letterSpacing: titleSize * -0.012,
                lineHeight: long ? 1.06 : 0.98,
                color: INK,
              }}
            >
              {title}
            </div>
            {line ? (
              <div style={{ display: 'flex', marginTop: 26, maxWidth: 640, fontFamily: 'Text', fontSize: 28, lineHeight: 1.34, letterSpacing: 0.1, color: INK2 }}>
                {line}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 19, letterSpacing: 1.5, color: INK }}>ARAV JAIN / ARAV.PRO</div>
        </div>
        {/* The stream runs down the card's right side, off both edges. */}
        <div style={{ position: 'relative', display: 'flex', width: 424, height: 630, marginTop: -56 }}>
          <Stream w={424} h={630} />
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
