import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * Open Graph cards in the site's own language. The home card is the home
 * page's first frame: a frozen lake running out to snow-covered ranges
 * under a low morning sun, with the name cut through the ice as dark water.
 * Every other card is lit stone with a stream of the page's water running
 * down one side. Set in the site's real faces (static instances, in
 * src/fonts/og).
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
 * The home page's first frame, held still: a morning sky with the sun low
 * on the left, three ranges under snow, each paler than the one in front,
 * a band of mist on the far shore, and the lake's ice running toward the
 * eye: wind-packed drifts of snow over clear blue ice, closer together
 * with distance, and a few pressure cracks near the foot of the frame.
 */
function Lake({ w, h, horizon }: { w: number; h: number; horizon: number }) {
  // A ridgeline: peaks of several sizes, sharp at the crest, the same every time it is drawn.
  const tri = (x: number) => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);
  const crest = (x: number, seed: number, base: number, amp: number) => {
    const massif = 0.35 + 0.65 * tri(x / 760 + seed * 0.37);
    const v = 0.56 * tri(x / 330 + seed) + 0.27 * tri(x / 121 + seed * 2.3) + 0.12 * tri(x / 47 + seed * 4.1) + 0.05 * tri(x / 19 + seed * 7.7);
    return base - amp * v * massif;
  };
  const ridge = (seed: number, base: number, amp: number, lift = 0) => {
    let d = `M0 ${horizon + 2}`;
    for (let x = 0; x <= w; x += 6) d += ` L${x} ${r1(crest(x, seed, base, amp) + lift)}`;
    return `${d} L${w} ${horizon + 2} Z`;
  };
  // Windows of clear blue ice between the drifts of snow: long shapes lying
  // along the wind, hairlines near the far shore, broad at the foot. Fewer
  // lie round the name, so the letters are read against snow.
  const drifts: { x: number; y: number; rx: number; ry: number; k: number }[] = [];
  for (let i = 0; i < 230; i++) {
    const t = Math.pow(rnd(i, 1), 1.6);
    const y = horizon + 8 + t * (h - horizon);
    if (y > 236 && y < 486 && rnd(i, 5) < 0.72) continue;
    drifts.push({ x: r1(rnd(i, 2) * (w + 300) - 150), y: r1(y), rx: r1((30 + rnd(i, 3) * 120) * (0.3 + 1.5 * t)), ry: r1((0.8 + rnd(i, 4) * 2.2) * (0.35 + 3.2 * t * t)), k: rnd(i, 6) });
  }
  const cracks = [
    `M-10 ${h - 96} C 150 ${h - 60}, 250 ${h - 40}, 330 ${h + 10}`,
    `M${w + 10} ${h - 150} C ${w - 120} ${h - 118}, ${w - 250} ${h - 70}, ${w - 300} ${h + 10}`,
    `M${w - 232} ${h - 82} C ${w - 190} ${h - 60}, ${w - 150} ${h - 30}, ${w - 140} ${h + 10}`,
  ];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9dbbdc" />
          <stop offset="0.6" stopColor="#c5d6e8" />
          <stop offset="1" stopColor="#dfe7ee" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.16" stopColor="#fffaf0" />
          <stop offset="0.4" stopColor="#fff3df" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff3df" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6ecf1" />
          <stop offset="0.3" stopColor="#eef3f6" />
          <stop offset="0.75" stopColor="#e7f1f5" />
          <stop offset="1" stopColor="#d5ebf1" />
        </linearGradient>
        <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e3eaf0" stopOpacity="0" />
          <stop offset="0.5" stopColor="#e3eaf0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#e3eaf0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={w} height={horizon + 4} fill="url(#sky)" />
      <circle cx="170" cy={horizon - 96} r="170" fill="url(#sun)" />
      {/* The ranges, furthest first: snow, with blue shade on the faces turned from the sun. */}
      <path d={ridge(1.2, horizon - 8, 112)} fill="#cdd9e6" />
      <path d={ridge(2.9, horizon - 4, 92)} fill="#dfe7ef" />
      <path d={ridge(2.9, horizon - 4, 92, 17)} fill="#c3d0de" opacity="0.6" />
      <path d={ridge(5.3, horizon - 1, 58)} fill="#edf1f5" />
      <path d={ridge(5.3, horizon - 1, 58, 11)} fill="#c9d5e1" opacity="0.65" />
      {/* The lake. */}
      <rect x="0" y={horizon} width={w} height={h - horizon} fill="url(#ice)" />
      {drifts.map((e, i) => (
        <ellipse key={i} cx={e.x} cy={e.y} rx={e.rx} ry={e.ry} fill={e.k > 0.55 ? '#9fd3e0' : e.k > 0.25 ? '#b9dfe8' : '#cfdcea'} opacity={r1(0.5 + e.k * 0.45)} />
      ))}
      {cracks.map((d, i) => (
        <g key={i} fill="none" strokeLinecap="round">
          <path d={d} stroke="#ffffff" strokeWidth="4" opacity="0.8" />
          <path d={d} stroke="#6aa9bb" strokeWidth="1.2" />
        </g>
      ))}
      <rect x="0" y={horizon - 12} width={w} height="26" fill="url(#mist)" />
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
  /** `home` is the home page's first frame, with the title cut through the lake's ice. */
  variant?: 'home' | 'page';
}

export async function renderOg({ kicker, title, line, variant = 'page' }: OgCard) {
  const data = await loadFonts();
  const long = title.length > 34;
  const longest = Math.max(...title.split(' ').map((w) => w.length));
  const titleSize = long ? 58 : title.length > 14 ? 84 : longest > 8 ? 104 : 120;

  const body =
    variant === 'home' ? (
      <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%' }}>
        <Lake w={1200} h={630} horizon={178} />
        {/* The line stands above the name, on the far ice; the address in the sky. */}
        <div style={{ position: 'absolute', display: 'flex', left: 56, top: 44, fontFamily: 'Mono', fontSize: 19, letterSpacing: 1.5, color: INK2 }}>{kicker.toUpperCase()}</div>
        <div style={{ position: 'absolute', display: 'flex', left: 0, top: 218, width: 1200, justifyContent: 'center', fontFamily: 'Display', fontSize: 38, letterSpacing: -0.4, lineHeight: 1, color: INK }}>
          {line}
        </div>
        {/* The name is cut through the sheet: a lit lip of snow under each
            letter, the far wall's blue above it, and dark water in the cut. */}
        {[
          { dy: 4, style: { color: '#ffffff' } },
          { dy: -3, style: { color: 'rgba(120,186,206,0.9)' } },
          { dy: 0, style: { backgroundImage: 'linear-gradient(180deg, #10283a 0%, #173a52 40%, #1f4f69 78%, #2b6682 100%)', backgroundClip: 'text', color: 'transparent' } },
        ].map((l, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              display: 'flex',
              left: 0,
              top: 276 + l.dy,
              width: 1200,
              justifyContent: 'center',
              fontFamily: 'Display',
              fontSize: 214,
              letterSpacing: -3,
              lineHeight: 1,
              ...l.style,
            }}
          >
            {title}
          </div>
        ))}
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
