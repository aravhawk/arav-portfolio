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
/** How much river the four last stations add after the tarn. */
export const EXT2 = 8000;
/** What lies past those stations is this much further on. */
const DO = DY + EXT + EXT2;
/** Where the last four stations' reach begins: the foot of the tarn. */
export const T2 = 11400 + DY;

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
export const POOL: Rect = { x: 1380, y: 8970 + DY, w: 800, h: 630 };
export const SHEET = { x: 1780, y: 9250 + DY, w: 600, h: 440 };

/** Station 4, the tarn, and the two shards of ice that stand in it. */
export const TARN = { x: 1300, y: 10800 + DY, rx: 820, ry: 640 };
export const SHARDS: { x: number; y: number; h: number; r: number; turn: number }[] = [
  { x: 1560, y: 10420 + DY, h: 400, r: 62, turn: 0.5 },
  { x: 1600, y: 11250 + DY, h: 520, r: 74, turn: -0.35 },
];

/** Station 5, the shallows, and the four columns of ice that stand in them: one to a model, as tall as its pulls. */
export const COLS = { y: T2 + 1080, xs: [1010, 1230, 1450, 1670], r: 56, hMax: 215, hMin: 14 };
/** How tall each column stands: linear in pulls, the tallest COLS.hMax, none under COLS.hMin. */
export const colHeights = (pulls: number[]) => {
  const max = Math.max(...pulls, 1);
  return pulls.map((n) => Math.max(COLS.hMin, (COLS.hMax * n) / max));
};

/** Station 6, the dam: a low wall of ice across the river with three sluices, and a channel below each. */
export const DAM = { y: T2 + 2700, x0: 860, x1: 1740, thick: 60, h: 84, gates: [1040, 1300, 1560], gw: 124 };
/** Each sluice's channel, from the dam down to where the three meet again. */
export const SLUICES: Pt[][] = [
  [pt(1040, DAM.y - 30), pt(1040, DAM.y + 150), pt(930, DAM.y + 420), pt(1000, DAM.y + 760), pt(1240, DAM.y + 1010)],
  [pt(1300, DAM.y - 30), pt(1300, DAM.y + 150), pt(1300, DAM.y + 420), pt(1300, DAM.y + 760), pt(1300, DAM.y + 1010)],
  [pt(1560, DAM.y - 30), pt(1560, DAM.y + 150), pt(1670, DAM.y + 420), pt(1600, DAM.y + 760), pt(1360, DAM.y + 1010)],
];

/** Station 7, the still pool and the four by four lattice of cubes of ice in it. */
export const LATTICE = { x: 1300, y: T2 + 4520, pitch: 172, size: 98, h: 56 };

/** Station 8, the canyon: the river's middle through a glacier, two tight bends back to back. */
export const CANYON = { y0: T2 + 5560, y1: T2 + 7160, x0: 780, x1: 2600, h: 240, w: 150, r: 220 };
const arc = (cx: number, cy: number, r: number, a0: number, a1: number): Pt[] =>
  Array.from({ length: 13 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / 12;
    return pt(cx + r * Math.cos(a), cy + r * Math.sin(a));
  });
/** North, a right turn to the east, a left turn to the north again. */
export const BENDS = [
  { x: 1300 + CANYON.r, y: T2 + 6000, turn: -1 },
  { x: 1800, y: T2 + 6220 + CANYON.r, turn: 1 },
];
export const CANYON_LINE: Pt[] = [
  pt(1300, T2 + 5350),
  pt(1300, T2 + 5700),
  ...arc(BENDS[0].x, BENDS[0].y, CANYON.r, Math.PI, Math.PI / 2),
  ...arc(BENDS[1].x, BENDS[1].y, CANYON.r, -Math.PI / 2, 0),
  pt(2020, T2 + 6800),
  pt(2020, T2 + 7150),
];
/** The polished face in the outer wall of the second bend, where the app is seen: its middle, width, height; it looks toward -x. */
export const FACE = { x: 2020 + CANYON.w / 2 - 4, y: T2 + 6300, w: 300, h: 187.5, z: 22 };

export interface NameLayout {
  /** the words, one per line */
  lines: string[];
  /** the width of the widest line, world units */
  width: number;
  /** how much taller than true the letters are drawn */
  stretch: number;
}

/** Carve the bed. Land runs on past every edge except the last, which is open water. */
export function paintWorld(b: BedPainter, tribs: number[] = [9, 5, 3, 2, 1, 1, 1], gate = 0) {
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
  b.channel([pt(1150, 7200 + DY), pt(960, 7480 + DY), pt(820, 7950 + DY), pt(680, 8450 + DY), pt(650, 8800 + DY), pt(720, 9200 + DY), pt(1080, 9800 + DY), pt(1350, 10150 + DY)], {
    width: [360, 390, 400, 370, 340, 330, 340, 420],
  });

  // The clear pool: fed by a thin spill at its head, drained by another at its foot.
  b.pool(POOL, 300);
  b.disc(pt(POOL.x + 200, POOL.y + 230), 200);
  b.disc(pt(POOL.x + POOL.w - 190, POOL.y + POOL.h - 210), 190);
  b.channel([pt(700, 8980 + DY), pt(1060, 9080 + DY), pt(1250, 9200 + DY), pt(1420, 9230 + DY)], { width: [46, 40, 44, 60], speed: 0.7 });
  b.channel([pt(1450, 9540 + DY), pt(1300, 9640 + DY), pt(1160, 9700 + DY), pt(1070, 9790 + DY)], { width: [60, 44, 40, 46], speed: 0.7 });
  b.channel([pt(1450, 8970 + DY), pt(1780, 9250 + DY), pt(1450, 9540 + DY)], { width: 480, speed: 0.12, flowOnly: true });

  // The tarn: wide, dark and still.
  const tarn = new Path2D();
  tarn.ellipse(TARN.x, TARN.y, TARN.rx, TARN.ry, 0, 0, Math.PI * 2);
  b.fill(tarn);
  b.disc(pt(TARN.x - 560, TARN.y - 330), 250);
  b.disc(pt(TARN.x + 520, TARN.y + 380), 260);
  b.disc(pt(TARN.x + 600, TARN.y - 280), 190);
  b.channel([pt(1350, 10150 + DY), pt(1330, 10400 + DY), pt(1300, 10800 + DY), pt(1300, 11400 + DY)], { width: 400, speed: 0.1, flowOnly: true });

  paintLater(b, gate);

  // The run-out: the river leaves the last station and opens into wide water.
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

/** The last four stations' reach: shallows, dam, pool, canyon. `gate` is the open sluice. */
function paintLater(b: BedPainter, gate: number) {
  // Out of the tarn and into the shallows where the columns stand.
  b.channel([pt(1300, T2 - 120), pt(1270, T2 + 250), pt(1300, T2 + 620)], { width: [330, 300, 420] });
  b.pool({ x: 880, y: T2 + 640, w: 1080, h: 820 }, 330);
  b.disc(pt(1010, T2 + 1290), 200);
  b.disc(pt(1830, T2 + 1150), 240);
  b.channel([pt(1300, T2 + 560), pt(1300, T2 + 1000), pt(1300, T2 + 1500)], { width: 700, speed: 0.1, flowOnly: true });
  // On to the head pond behind the dam.
  b.channel([pt(1300, T2 + 1400), pt(1240, T2 + 1850), pt(1300, T2 + 2300), pt(1300, DAM.y - 200)], { width: [330, 280, 360, 560], speed: 0.45 });
  b.pool({ x: DAM.x0 + 30, y: DAM.y - 250, w: DAM.x1 - DAM.x0 - 60, h: 260 }, 120);
  SLUICES.forEach((line, i) => {
    b.channel(line, { width: [DAM.gw, DAM.gw, 130, 130, 150], speed: i === gate ? 1 : 0.07 });
  });
  for (const line of SLUICES) b.agitate(pt(line[0].x, DAM.y + DAM.thick + 40), 110, 0.0);
  b.agitate(pt(SLUICES[gate][0].x, DAM.y + DAM.thick + 50), 130, 0.9);
  // The three meet and run on into the still pool.
  b.channel([pt(1300, DAM.y + 960), pt(1300, DAM.y + 1150), pt(1300, T2 + 4060)], { width: [300, 260, 300] });
  const half = LATTICE.pitch * 2 + 150;
  b.pool({ x: LATTICE.x - half, y: LATTICE.y - half, w: half * 2, h: half * 2 }, 210);
  b.disc(pt(LATTICE.x - half + 60, LATTICE.y + 200), 190);
  b.disc(pt(LATTICE.x + half - 40, LATTICE.y - 230), 180);
  // Out of the pool, into the canyon, and round to the run-out.
  b.channel([pt(1300, LATTICE.y + half - 40), pt(1300, T2 + 5200), pt(1300, T2 + 5360)], { width: [260, 200, CANYON.w] });
  b.channel(CANYON_LINE, { width: CANYON.w, straight: true });
  // (The outside of the second bend is cut square: a flat wall faces the water that comes at it.)
  b.pool({ x: 1800, y: T2 + 6220 - CANYON.w / 2, w: 220 + CANYON.w / 2, h: 300 }, 16);
  b.channel([pt(2020, T2 + 7100), pt(1960, T2 + 7450), pt(1560, T2 + 7780), pt(1300, T2 + EXT2 - 20)], { width: [CANYON.w, 240, 300, 320] });
  // Fast water on the outside of each bend.
  for (const c of BENDS) {
    const out = c.turn < 0 ? pt(c.x - 0.75 * CANYON.r, c.y + 0.75 * CANYON.r) : pt(c.x + 0.75 * CANYON.r, c.y - 0.75 * CANYON.r);
    b.agitate(out, 150, 0.8);
  }
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
