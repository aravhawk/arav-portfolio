/**
 * The world of the flight, authored in world units instead of read from the
 * DOM. One fixed stretch of glacial country: a frozen lake, the river that
 * leaves it, a walled basin with an island, and open water.
 *
 * Axes: x to the right, y forward (the way the camera flies), z up. Seen on
 * a map with y running down this is the page's own layout (lake at the top,
 * river down the middle), so the bed painter, the ice field and the
 * simulation are used exactly as the page uses them.
 *
 * Because the camera looks along +y, "up" in the picture is +y. The name is
 * therefore drawn with its tops toward +y, and taller than it is wide by
 * the amount the first camera foreshortens it, so it reads at its true
 * proportions from where the flight begins.
 */

import { type BedPainter, type Pt, type Rect, pt } from './bed';

/**
 * How much longer the lake is than the first build's. The lake has to run
 * from under the first camera to a far shore near the horizon, so the
 * river, the basin and the open water all lie this much further on.
 */
export const DY = 4000;

/** How much river the three later stations add between the basin and open water. */
export const EXT = 5300;
/** What lies past those stations is this much further on. */
const DO = DY + EXT;

export const WORLD = { w: 2600, h: 8400 + DO };

/** The lake's north and south shores. */
// (It is wider than the world: past the world's sides the bed repeats its
// last column, so the ice runs on to left and right without a shore.)
export const LAKE = { x0: -700, x1: WORLD.w + 700, y0: -900, y1: 2050 + DY };
/** Where the river leaves the lake, and how wide it is there. */
export const OUTLET = { x: 1480, y: LAKE.y1, w: 300 };

/** The middle of the name on the lake. */
export const NAME = { x: 1300, y: 1700 };

/** The river's middle line from the lake to the basin. */
export const RIVER: Pt[] = [pt(1480, 2030 + DY), pt(1610, 2520 + DY), pt(1500, 3060 + DY), pt(1690, 3620 + DY), pt(1570, 4180 + DY), pt(1600, 4560 + DY)];
const RIVER_W = [300, 250, 285, 240, 280, 300];

/** The stream's middle from the lake to open water, for what is drawn along it. */
export const STREAM: Pt[] = [
  ...RIVER,
  pt(1480, 4800 + DY),
  pt(1250, 5200 + DY),
  pt(1430, 5560 + DY),
  pt(1500, 5900 + DY),
  pt(1750, 6300 + DY),
  pt(1980, 6650 + DY),
  pt(1900, 6950 + DY),
  pt(1500, 7080 + DY),
  pt(1150, 7200 + DY),
  pt(960, 7480 + DY),
  pt(820, 7950 + DY),
  pt(780, 8450 + DY),
  pt(950, 8800 + DY),
  pt(960, 9200 + DY),
  pt(1080, 9800 + DY),
  pt(1350, 10150 + DY),
  pt(1300, 11450 + DY),
  pt(1300, 11700 + DY),
  pt(1300, 12000 + DY),
];

/** The walled basin (the sandbox) and the island in it. */
export const BASIN: Rect = { x: 1050, y: 4520 + DY, w: 1120, h: 1080 };
export const ISLAND = { x: 1560, y: 5110 + DY, rx: 275, ry: 150 };

/** The upright slab that carries the product image. */
export const SLAB = {
  /** middle of its foot */
  x: ISLAND.x,
  y: ISLAND.y - 50,
  w: 430,
  h: 372,
  thick: 150,
  /** its foot stands this far above the ground, on a low plinth of ice */
  lift: 0,
  /** which way its face looks, in radians from -y toward -x: it faces the camera that arrives at the basin */
  turn: 0.16,
};

/** Where the river has become open water. */
export const SHOAL_Y = 6650 + DO;

/**
 * Station 2, the confluence. The river turns and runs west across the view;
 * seven streams come down out of the snowfield beyond it, toward the eye.
 * Each is { head, mouth }: where it rises and where it meets the river.
 */
export const CONF_Y = 7150 + DY;
export const TRIBS: { head: Pt; mid: Pt; mouth: Pt }[] = [
  [2300, 8300, 2130, 7739, 1880, 7059],
  [2040, 8380, 1840, 7808, 1740, 7117],
  [1810, 8330, 1755, 7810, 1610, 7171],
  [1600, 8400, 1510, 7867, 1500, 7215],
  [1410, 8350, 1440, 7863, 1400, 7257],
  [1240, 8400, 1240, 7908, 1310, 7296],
  [1080, 8340, 1185, 7895, 1230, 7331],
].map(([hx, hy, mx, my, x, y]) => ({ head: pt(hx, hy + DY), mid: pt(mx, my + DY), mouth: pt(x, y + DY) }));
/** How wide a stream with this many merged pull requests runs. */
export const tribWidth = (n: number) => 8 + 16 * Math.min(n, 10);

/** Station 3, the clear pool beside the river, and the picture on its bed. */
export const POOL: Rect = { x: 1230, y: 8840 + DY, w: 1040, h: 800 };
export const SHEET = { x: 1750, y: 9250 + DY, w: 600, h: 430 };

/** Station 4, the tarn, and the two shards of ice that stand in it. */
export const TARN = { x: 1300, y: 10800 + DY, rx: 820, ry: 640 };
export const SHARDS: { x: number; y: number; h: number; r: number; turn: number }[] = [
  { x: 820, y: 10560 + DY, h: 430, r: 62, turn: 0.5 },
  { x: 1800, y: 11120 + DY, h: 470, r: 66, turn: -0.35 },
];

export interface NameLayout {
  /** the words, one per line */
  lines: string[];
  /** the width of the widest line, world units */
  width: number;
  /** how much taller than true the letters are drawn */
  stretch: number;
}

/** Carve the bed. Land runs on past every edge except the last, which is open water. */
export function paintWorld(b: BedPainter, tribs: number[] = [9, 5, 3, 2, 1, 1, 1]) {
  // The lake: one broad body with bays, so its shore is never a ruled curve.
  b.pool({ x: LAKE.x0, y: LAKE.y0, w: LAKE.x1 - LAKE.x0, h: LAKE.y1 - LAKE.y0 }, 640);
  // Bays and points along the far shore, so it is never a ruled line.
  for (const [x, dy, r] of [
    [140, -40, 300],
    [620, 70, 260],
    [1010, -10, 210],
    [1960, 60, 280],
    [2420, -60, 330],
  ]) {
    b.disc(pt(x, LAKE.y1 - r * 0.72 + dy), r);
  }
  b.dry({ x: 760, y: LAKE.y1 - 150, w: 330, h: 260 }, 0, 120);
  b.dry({ x: 2080, y: LAKE.y1 - 120, w: 300, h: 240 }, 0, 110);
  // A slow current gathers toward the outlet, so meltwater leaves the lake.
  for (const t of [0.2, 0.5, 0.8]) {
    const x = WORLD.w * t;
    b.channel([pt(x, LAKE.y1 - 1900), pt((x + OUTLET.x) / 2, LAKE.y1 - 900), pt(OUTLET.x, LAKE.y1 - 30)], { width: 760, speed: 0.34, flowOnly: true });
  }
  b.agitate(pt(OUTLET.x, LAKE.y1 - 10), OUTLET.w * 1.4, 0.7);
  b.outlet = { x: OUTLET.x, y: OUTLET.y, w: OUTLET.w };

  // The river: it wanders, swells and narrows.
  b.channel(RIVER, { width: RIVER_W });

  // The basin, walled all round, with the river running in at its head.
  b.pool(BASIN, 300);
  b.disc(pt(BASIN.x + 240, BASIN.y + BASIN.h - 300), 260);
  b.disc(pt(BASIN.x + BASIN.w - 250, BASIN.y + 330), 270);
  b.channel([pt(1600, 4540 + DY), pt(1480, 4800 + DY), pt(1250, 5200 + DY), pt(1420, 5560 + DY)], { width: 420, speed: 0.4, flowOnly: true });
  // The island: dry ground in the middle of it.
  b.dry({ x: ISLAND.x - ISLAND.rx, y: ISLAND.y - ISLAND.ry, w: ISLAND.rx * 2, h: ISLAND.ry * 2 }, 0, ISLAND.ry * 0.96);
  // Attacks: waves strike the island from every side.
  for (const [dx, dy] of [
    [-1.5, -0.9],
    [1.45, -0.7],
    [-1.4, 1.1],
    [1.5, 1.0],
    [0, -1.7],
    [0.1, 1.8],
  ]) {
    b.agitate(pt(ISLAND.x + dx * ISLAND.rx, ISLAND.y + dy * ISLAND.ry), 190, 0.6);
  }

  // Below the basin the river narrows, bends, and turns east for the confluence.
  b.channel([pt(1440, 5560 + DY), pt(1500, 5900 + DY), pt(1750, 6300 + DY), pt(1980, 6650 + DY), pt(1900, 6950 + DY), pt(1500, 7080 + DY), pt(1150, 7200 + DY)], {
    width: [320, 300, 190, 200, 230, 300, 360],
  });
  // The streams: each as wide as its count, each with its own fall into the river.
  TRIBS.forEach((t, i) => {
    const n = tribs[i] ?? 0;
    if (n <= 0) return;
    const w = tribWidth(n);
    b.channel([t.head, t.mid, t.mouth, pt(t.mouth.x - 50, t.mouth.y - 110)], { width: [w * 0.55, w * 0.8, w, w], speed: 1 });
    b.disc(t.head, w * 0.42);
    b.agitate(t.mouth, 60 + w, 0.5 + 0.05 * Math.min(n, 9));
  });
  // The bigger river below it swings north again past the pool.
  b.channel([pt(1150, 7200 + DY), pt(960, 7480 + DY), pt(820, 7950 + DY), pt(780, 8450 + DY), pt(950, 8800 + DY), pt(960, 9200 + DY), pt(1080, 9800 + DY), pt(1350, 10150 + DY)], {
    width: [360, 390, 400, 370, 340, 330, 340, 420],
  });

  // The clear pool: fed by a thin spill at its head, drained by another at its foot.
  b.pool(POOL, 300);
  b.disc(pt(POOL.x + 200, POOL.y + 230), 200);
  b.disc(pt(POOL.x + POOL.w - 190, POOL.y + POOL.h - 210), 190);
  b.channel([pt(860, 8660 + DY), pt(1080, 8770 + DY), pt(1280, 8900 + DY)], { width: [46, 40, 60], speed: 0.7 });
  b.channel([pt(1340, 9560 + DY), pt(1160, 9700 + DY), pt(1070, 9790 + DY)], { width: [60, 40, 46], speed: 0.7 });
  b.channel([pt(1300, 8920 + DY), pt(1650, 9200 + DY), pt(1360, 9540 + DY)], { width: 520, speed: 0.12, flowOnly: true });

  // The tarn: wide, dark and still.
  const tarn = new Path2D();
  tarn.ellipse(TARN.x, TARN.y, TARN.rx, TARN.ry, 0, 0, Math.PI * 2);
  b.fill(tarn);
  b.disc(pt(TARN.x - 560, TARN.y - 330), 250);
  b.disc(pt(TARN.x + 520, TARN.y + 380), 260);
  b.disc(pt(TARN.x + 600, TARN.y - 280), 190);
  b.channel([pt(1350, 10150 + DY), pt(1330, 10400 + DY), pt(1300, 10800 + DY), pt(1300, 11400 + DY)], { width: 400, speed: 0.1, flowOnly: true });

  // The run-out: the river leaves the tarn and opens into wide water.
  b.channel([pt(1300, 5560 + DO + 500), pt(1300, 5900 + DO + 300), pt(1300, 6300 + DO), pt(1300, 6700 + DO), pt(1300, 7150 + DO)], { width: [320, 340, 520, 1300, 3400] });
  b.pool({ x: -400, y: 7000 + DO, w: WORLD.w + 800, h: WORLD.h - 7000 - DO + 400 }, 0);
  // The open water's shore is a run of bays and points, never a ruled line.
  for (const [x, dy, r] of [
    [-120, 40, 300],
    [260, -70, 250],
    [640, 30, 230],
    [930, -110, 260],
    [1700, -120, 270],
    [2010, 20, 240],
    [2380, -60, 260],
    [2740, 50, 300],
  ]) {
    b.disc(pt(x, 7000 + DO + r * 0.45 + dy), r);
  }
  for (const t of [0.2, 0.5, 0.8]) {
    b.channel([pt(WORLD.w * t, 6900 + DO), pt(WORLD.w * t, WORLD.h)], { width: WORLD.w * 0.42, speed: 0.6, flowOnly: true, straight: true });
  }
  b.shoal = SHOAL_Y;
}

export interface NameRaster {
  alpha: Uint8ClampedArray;
  tw: number;
  th: number;
  /** world units per texel */
  scale: number;
  rect: Rect;
}

/**
 * The name, drawn at a fixed size in world units. Its tops point along +y
 * (away from the first camera), which on the raster is a flip.
 */
export function rasterName(layout: NameLayout, fontFamily: string): NameRaster {
  const probe = document.createElement('canvas').getContext('2d')!;
  const fontPx = 200;
  const font = `800 ${fontPx}px ${fontFamily}`;
  const ls = -0.045 * fontPx;
  probe.font = font;
  const runOf = (text: string) => probe.measureText(text).width + ls * (text.length - 1);
  const widest = Math.max(...layout.lines.map(runOf));
  // Text space to world: k units per font px across, k * stretch up.
  const k = layout.width / widest;
  const lineH = fontPx * 0.9;
  const textH = lineH * layout.lines.length;
  const pad = fontPx * 0.24 * k;
  const w = layout.width + pad * 2;
  const h = textH * k * layout.stretch + pad * 2;
  const rect = { x: NAME.x - w / 2, y: NAME.y - h / 2, w, h };
  const tw = Math.min(1536, Math.max(256, Math.round(w)));
  const scale = w / tw;
  // The raster is the name at its true proportions: a texel is `scale`
  // units across and `scale * stretch` units deep on the lake. Distances
  // measured in it are therefore the ones the first camera sees, so an
  // opening that grows as the ice melts grows evenly round every stroke
  // in the picture, and the letters keep their shape while they do.
  const th = Math.max(16, Math.round(h / (scale * layout.stretch)));
  const c = document.createElement('canvas');
  c.width = tw;
  c.height = th;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  // World x grows with text x; world y falls as text y grows.
  ctx.setTransform(k / scale, 0, 0, -k / scale, tw / 2, th / 2);
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  layout.lines.forEach((text, i) => {
    const m = ctx.measureText(text);
    const asc = m.actualBoundingBoxAscent || fontPx * 0.72;
    // Each line's capitals are centred in its band.
    const mid = -textH / 2 + lineH * (i + 0.5);
    const baseline = mid + asc / 2;
    const start = -runOf(text) / 2;
    let x = start;
    for (let n = 0; n < text.length; n++) {
      ctx.fillText(text[n], x, baseline);
      x = start + ctx.measureText(text.slice(0, n + 1)).width + ls * (n + 1);
    }
  });
  return { alpha: ctx.getImageData(0, 0, tw, th).data, tw, th, scale, rect };
}
