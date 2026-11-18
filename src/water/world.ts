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
/** Where the last four stations' reach begins: the foot of the tarn. */
export const T2 = 11400 + DY;

/** The world ends in open sea: its last rows are water from side to side, and past them the bed repeats, so the sea has no far shore. */
export const WORLD = { w: 2600, h: T2 + 9900 };

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
/** The round point of bank that stands out into the basin's south-west corner: its middle and its radius. */
export const BANK = { x: 866, y: 4890 + DY, r: 367 };
/**
 * The block stands at the island's near shore with its foot in the water: the
 * island is the ice-bound rock behind it and to either side, so the basin's
 * waves reach the block itself.
 */
export const ISLAND = { x: 1575, y: 5275 + DY, rx: 335, ry: 150 };

/** The block of ice that carries the product image. */
export const SLAB = {
  /** middle of the foot of its front face */
  x: 1560,
  y: 5060 + DY,
  w: 430,
  /** from the waterline to its top */
  h: 431,
  thick: 150,
  /** its foot is at the basin's water, this far below the land (the basin's freeboard) */
  lift: -59,
  /** which way its face looks, in radians from -y toward -x: it faces the camera that arrives at the basin */
  turn: 0.16,
};

/**
 * The block's faces. It is a piece calved from a glacier's face, not a cut
 * box: a solid bounded by flat planes, in its own frame (x across its
 * front, y into it, z up from the water). The front is the one polished
 * face; the sides lean, the top slopes, two corners of the top and two
 * arrises have broken away. Each face is its outward normal and its
 * distance from the middle of the front's foot. None cuts into the picture.
 */
export function slabFaces(): [number, number, number, number][] {
  const hw = SLAB.w / 2;
  const { h, thick } = SLAB;
  const face = (n: [number, number, number], p: [number, number, number]): [number, number, number, number] => {
    const l = Math.hypot(n[0], n[1], n[2]);
    const u = n.map((v) => v / l);
    return [u[0], u[1], u[2], u[0] * p[0] + u[1] * p[1] + u[2] * p[2]];
  };
  return [
    face([0, -1, 0], [0, 0, 0]), // 0: the polished front
    face([0.04, 1, 0.1], [0, thick, 0]), // 1: the back, leaning in
    face([-1, 0.03, 0.055], [-hw, 0, 0]), // 2: the left side
    face([1, -0.04, 0.03], [hw, 0, 0]), // 3: the right side
    face([0.08, 0.1, 1], [-hw, 0, h]), // 4: the top, sloping
    face([0, 0, -1], [0, 0, 0]), // 5: the foot
    face([-0.62, -0.05, 0.78], [-hw, 0, h - 72]), // 6: the top's left corner, broken away
    face([0.45, 0.1, 0.89], [hw - 11, 0, h - 64]), // 7: its right corner
    face([-0.8, -0.6, 0.02], [-hw + 15, 0, 0]), // 8: the front's left arris
    face([0.7, -0.55, -0.45], [hw - 30, 0, 0]), // 9: the front's right arris, at the foot
    face([-0.1, 0.62, 0.78], [0, thick - 40, h - 34]), // 10: the back of the top
    face([-0.85, 0.5, 0.15], [-hw + 34, thick, 0]), // 11: the back's left corner
  ];
}

/**
 * The delta. Out of the glacier the river turns toward the light, slows, and
 * braids out into the sea: distributaries that part round bars of snow and
 * meet again. West of it a broad bank runs on to a cape; that bank is where
 * the words stand.
 */
export const DELTA = { apex: pt(1560, T2 + 7760), y: T2 + 8150, sea: T2 + 8900 };
/** Where the river has become shallows over bars. */
export const SHOAL_Y = DELTA.y;
/** Where the camera comes to rest over the sea. */
export const REST = pt(2250, T2 + 10350);

/**
 * Station 2, the confluence. The river turns and runs west along the foot
 * of a cliff of ice; above the cliff lies a snowfield, and seven streams
 * come down across it toward the eye and fall over the cliff's lip into
 * the river. Each stream is as wide as its count.
 *
 * LIP is the cliff's line (straight in plan): y = y0 + (x0 - x) * m. The
 * snowfield stands LIP.h above the land east of x1, where the cliff turns
 * a corner and runs north along the river that leaves; it runs on past the
 * world's east side, and eases down to the land beyond `back`. Each stream is { head, mid, mouth }:
 * where it rises, a point on its way, and where it goes over the lip.
 */
export const LIP = { x0: 2200, y0: 7000 + DY, m: 0.3, h: 100, x1: 1300, back: 8380 + DY, backRamp: 260, foot: 28 };
export const lipY = (x: number) => LIP.y0 + (LIP.x0 - x) * LIP.m;
export const CONF_Y = lipY(1750);
/** The river's width above the first stream, and how much of its width each stream adds to it. */
export const CONF_RIVER = { w: 220, add: 0.6 };
export const TRIBS: { head: Pt; mid: Pt; mouth: Pt }[] = [
  [2160, 8290, 2150, 7700, 2080],
  [1960, 8340, 1900, 7760, 1874],
  [1790, 8300, 1770, 7740, 1728],
  [1640, 8350, 1600, 7790, 1612],
  [1500, 8310, 1520, 7780, 1516],
  [1370, 8350, 1400, 7810, 1430],
  [1240, 8300, 1300, 7800, 1344],
].map(([hx, hy, mx, my, x]) => ({ head: pt(hx, hy + DY), mid: pt(mx, my + DY), mouth: pt(x, lipY(x)) }));
/** How wide a stream with this many merged pull requests runs: in proportion, so the counts can be read off the widths. */
export const tribWidth = (n: number) => 20 * Math.min(n, 10);
/** How wide the river is at x along the cliff's foot, given each stream's width: it takes each stream in turn. */
export const confRiverWidth = (x: number, widths: number[]) =>
  CONF_RIVER.w +
  TRIBS.reduce((sum, t, i) => {
    const w = widths[i] ?? 0;
    const k = Math.min(1, Math.max(0, (t.mouth.x + w / 2 - x) / (w + 60)));
    return sum + CONF_RIVER.add * w * k * k * (3 - 2 * k);
  }, 0);

/**
 * Station 3, the rock pool beside the river, and the results on its bed.
 *
 * The results are set as type. BOARD_HEAD and BOARD_ROWS are a transcription
 * of the leaderboard in the published picture (public/media/
 * kilo-bench-results-2324.webp, the Devpost gallery's "kilo-bench complete
 * results"): its header and its three rows, character for character. Nothing
 * is added and nothing is rounded; the picture itself stays the source of
 * truth on the project page. (Its rank medals and its "Use" control are not
 * results and are left out. The header's sort arrow after "Score" is drawn.)
 *
 * The table lies on the bed as one dark slab. A narrow frame is shown its
 * first columns (the models and their scores), a wide one all five, so its
 * type is always large enough to be read.
 */
export const BOARD_HEAD = ['Model', 'Score', 'Cost', 'Time', 'Tokens'];
export const BOARD_ROWS = [
  ['anthropic/claude-sonnet-4.6', '7.6', '$0.7726', '719.9s', '53.3k'],
  ['anthropic/claude-opus-4.6', '7.4', '$1.1007', '832.3s', '45.8k'],
  ['openai/gpt-5.2-codex', '6.3', '$0.3207', '410.1s', '24.7k'],
];
/**
 * The table's measure, in world units. `em` is its type's size (the mono
 * face advances 0.6 of it a character); `pad` its margin at either side;
 * `head` and `row` how deep the header and each row lie; `gap` the clear
 * space before a column, in characters (the scores stand close to the names
 * they belong to).
 */
export const BOARD = { em: 15, pad: 12, head: 41, row: 49, gap: [0, 2.5, 2.5, 2.5, 2.5] };
/** How wide a character of the table's type is. */
export const BOARD_CH = BOARD.em * 0.6;
/** A point stands in a narrower cell than a letter, so a figure holds together ("7.6", not "7 .6"). */
export const BOARD_DOT = BOARD.em * 0.42;
/** How wide a run of the table's type is. */
export const boardRun = (text: string) => [...text].reduce((w, c) => w + (c === '.' ? BOARD_DOT : BOARD_CH), 0);
/** How deep the whole table lies. */
export const BOARD_DEPTH = BOARD.head + BOARD.row * BOARD_ROWS.length;
/**
 * Where each column ends, from the table's west edge. The models are set
 * from the left; every figure ends at its column's right edge, under its
 * heading's last letter. (The heading of the scores is wider than a score:
 * it reaches back over the end of the names' column, where the header row
 * is empty.)
 */
export const boardEdges = (): number[] => {
  const out: number[] = [];
  let x = BOARD.pad;
  BOARD_HEAD.forEach((head, i) => {
    const widest = Math.max(...BOARD_ROWS.map((r) => boardRun(r[i])), i < 2 ? 0 : boardRun(head));
    x += BOARD.gap[i] * BOARD_CH + widest;
    out.push(x);
  });
  return out;
};
/** How many columns a frame of this shape is shown. */
export const sheetCols = (aspect: number) => (aspect < 0.62 ? 2 : aspect < 1.72 ? (aspect < 0.9 ? 3 : 2) : aspect < 2.2 ? 3 : aspect < 2.7 ? 4 : 5);
/** How wide the table lies when it shows its first n columns. */
export const boardSpan = (n: number) => boardEdges()[n - 1] + BOARD.pad;
/** The table: where its west edge and its middle lie. */
export const SHEET = { x0: 1800, y: 9330 + DY };
/**
 * The project page shows the picture itself, as plates side by side: one to
 * a column of the table, each a crop of the picture's own pixels
 * (SHEET_COLS, in the picture's pixels at 2000 wide: x, width; SHEET_SRC:
 * the picture's size, and where the table's rows lie in it).
 */
export const SHEET_SRC = { w: 2000, h: 1088, y: 246, rows: 198 };
export const SHEET_COLS: [number, number][] = [
  [162, 237],
  [875, 87],
  [1133, 90],
  [1378, 80],
  [1610, 78],
];
/** The pool's shore, a closed line: bays and points, no ruled side. (POOL is the box round it.) */
export const POOL_SHORE: [number, number][] = [
  [1776, 9244],
  [1772, 9160],
  [1840, 9128],
  [1930, 9150],
  [2040, 9112],
  [2150, 9136],
  [2262, 9104],
  [2372, 9140],
  [2452, 9214],
  [2440, 9330],
  [2476, 9450],
  [2462, 9560],
  [2380, 9640],
  [2270, 9612],
  [2170, 9668],
  [2060, 9650],
  [1960, 9700],
  [1846, 9668],
  [1780, 9590],
  [1790, 9500],
  [1774, 9420],
  [1780, 9334],
];
export const POOL: Rect = { x: 1712, y: 9104 + DY, w: 764, h: 596 };
/**
 * The boulders that stand in the pool: where, how wide (two half-widths
 * and the way the long one lies), and how high above the water. None
 * stands where its image would lie across the plates.
 */
export const ROCKS: { x: number; y: number; a: number; b: number; turn: number; h: number }[] = [
  { x: 1742, y: 9486, a: 44, b: 30, turn: 0.5, h: 40 },
  { x: 1850, y: 9604, a: 60, b: 40, turn: -0.3, h: 58 },
  { x: 2060, y: 9588, a: 34, b: 24, turn: 0.9, h: 26 },
  { x: 2210, y: 9566, a: 74, b: 48, turn: 0.2, h: 70 },
  { x: 2350, y: 9524, a: 40, b: 30, turn: -0.7, h: 34 },
  { x: 2150, y: 9178, a: 32, b: 20, turn: 0.2, h: 22 },
  { x: 2452, y: 9480, a: 46, b: 32, turn: 1.2, h: 48 },
].map((r) => ({ ...r, y: r.y + DY }));
/** How many flat faces a boulder is cut by. */
export const ROCK_FACES = 9;
/**
 * A boulder's faces: frost breaks granite along planes, so each is a solid
 * cut by a few of them (five round its sides, leaning in, and two across
 * its top). Each face is its outward normal and its distance from the
 * boulder's middle at the waterline.
 */
export function rockFaces(i: number): [number, number, number, number][] {
  const r = ROCKS[i];
  const rnd = (k: number) => {
    const v = Math.sin(i * 127.1 + k * 311.7 + 4.3) * 43758.5453;
    return v - Math.floor(v);
  };
  const out: [number, number, number, number][] = [];
  for (let j = 0; j < ROCK_FACES; j++) {
    // Five round its sides, two shoulders, two across its crown.
    const side = j < 5;
    const az = side ? (j * Math.PI * 2) / 5 + (rnd(j) - 0.5) * 0.85 : rnd(j) * 6.283 + (j % 2 ? Math.PI : 0);
    const lean = side ? 0.08 + 0.5 * rnd(j + 10) : j < 7 ? 0.55 + 0.3 * rnd(j + 10) : 1.05 + 0.4 * rnd(j + 10);
    // (In the boulder's own frame, then turned the way it lies.)
    const lx = Math.cos(az) * Math.cos(lean);
    const ly = Math.sin(az) * Math.cos(lean);
    const lz = Math.sin(lean);
    const d = Math.hypot(r.a * lx, r.b * ly, r.h * lz) * (0.74 + 0.26 * rnd(j + 20));
    const c = Math.cos(r.turn);
    const sn = Math.sin(r.turn);
    out.push([c * lx - sn * ly, sn * lx + c * ly, lz, d]);
  }
  return out;
}

/** Station 4, the tarn, and the two shards of ice that stand in it. */
export const TARN = { x: 1300, y: 10800 + DY, rx: 820, ry: 640 };
/** The bay at the tarn's south-west, where the river comes in: still water under the eye that looks across the tarn. */
export const TARN_BAY = { x: 1120, y: 10040 + DY, r: 240 };
export const SHARDS: { x: number; y: number; h: number; r: number; turn: number }[] = [
  { x: 1648, y: 10590 + DY, h: 400, r: 62, turn: 0.5 },
  { x: 1527, y: 11090 + DY, h: 520, r: 74, turn: -0.35 },
];

/**
 * Station 5, the shallows, and the four seracs that stand in them: one pillar of glacier ice to a model.
 * Every one is cut to the same measure (a pillar `r` across for every `hMax` tall), so the ice in it is in
 * proportion to its pulls: its height (and its width with it) goes as the cube root. Each is broken in its
 * own way inside that measure: it leans (`lean`: which way, radians from +x), it has a shoulder, a block has
 * fallen from it. Its highest point stands at its scaled height. r is the tallest one's radius.
 */
export const COLS = { y: T2 + 1080, xs: [1010, 1230, 1450, 1670], r: 52, hMax: 300, hMin: 40, lean: [-0.7, 2.62, 0.35, 3.5], apex: 0.4 };
/** Where a serac's highest point stands, off its own middle line: x and y in units of its radius. */
export const colApex = (i: number): [number, number] => [COLS.apex * Math.cos(COLS.lean[i]), COLS.apex * Math.sin(COLS.lean[i])];
/** How tall each column stands: its volume is linear in pulls, the tallest COLS.hMax high, none under COLS.hMin. */
export const colHeights = (pulls: number[]) => {
  const max = Math.max(...pulls, 1);
  return pulls.map((n) => Math.max(COLS.hMin, COLS.hMax * Math.cbrt(Math.max(n, 0) / max)));
};

/**
 * Station 6, the dam: one wall of ice across the river, a deep pond `pond` long behind it, three sluices cut
 * through it, and a channel below each. The wall is `thick` at its crest and leans back below (`batter`); each
 * sluice is a cut through that lean down to the water, with the crest running on over it as a lintel `lintel`
 * deep, and at the head of the cut a gate of clear ice that lifts by `lift` into the wall. The wall's two ends
 * run down into the banks (`hip`). The camera looks back at it from downstream, so the sluices are listed east
 * to west: that is left to right in the picture, the order of the switch's options.
 */
export const DAM = { y: T2 + 2700, x0: 760, x1: 1840, thick: 36, batter: 0.5, h: 150, gates: [1560, 1300, 1040], gw: 84, lift: 56, lintel: 64, hip: 1.5, pond: 560 };
/** Each sluice's channel, from the dam down to where the three meet again. */
export const SLUICES: Pt[][] = [
  [pt(1560, DAM.y - 30), pt(1560, DAM.y + 150), pt(1670, DAM.y + 420), pt(1600, DAM.y + 760), pt(1360, DAM.y + 1010)],
  [pt(1300, DAM.y - 30), pt(1300, DAM.y + 150), pt(1300, DAM.y + 420), pt(1300, DAM.y + 760), pt(1300, DAM.y + 1010)],
  [pt(1040, DAM.y - 30), pt(1040, DAM.y + 150), pt(930, DAM.y + 420), pt(1000, DAM.y + 760), pt(1240, DAM.y + 1010)],
];

/** Station 7, the still pool and the four by four lattice of cubes of ice in it. */
export const LATTICE = { x: 1300, y: T2 + 4520, pitch: 172, size: 92, h: 50 };

/** Station 8, the canyon: the river's middle through a glacier, two tight bends back to back. */
// (Its walls lean back as they rise, by `lean` units to each unit of height, so the sky and the day reach the water.)
export const CANYON = { y0: T2 + 5560, y1: T2 + 7160, x0: 780, x1: 2600, h: 300, w: 230, r: 220, lean: 0.28 };
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
/** The hall the second bend opens into: square-cut, so one flat wall faces the water that comes at it. x0, y0, x1, y1 of its open air. */
export const HALL = { x0: 1800, y0: T2 + 6110, x1: 2020 + CANYON.w / 2 - 16, y1: T2 + 6510 };
export const FACE = { x: 2020 + CANYON.w / 2 - 15, y: T2 + 6275, w: 320, h: 200, z: 14 };

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
  // The near bank comes out into the basin's south-west corner in one broad round point: the station's name, its
  // arrow and its lines stand on that snow, and the water begins a good way past them.
  b.dry({ x: BANK.x - BANK.r, y: BANK.y - BANK.r, w: BANK.r * 2, h: BANK.r * 2 }, 0, BANK.r);
  b.dry({ x: BASIN.x - 50, y: BASIN.y - 40, w: 170, h: 170 }, 0, 50);
  // (Where the river comes in the basin's wall opens to it in a curve, not a square corner.)
  b.disc(pt(1380, BASIN.y + 70), 150);
  b.disc(pt(1830, BASIN.y + 60), 140);
  b.channel([pt(1600, 4540 + DY), pt(1480, 4800 + DY), pt(1250, 5200 + DY), pt(1420, 5560 + DY)], { width: 420, speed: 0.4, flowOnly: true });
  // The island: dry ground in the middle of it.
  b.dry({ x: ISLAND.x - ISLAND.rx, y: ISLAND.y - ISLAND.ry, w: ISLAND.rx * 2, h: ISLAND.ry * 2 }, 0, ISLAND.ry * 0.96);
  // (Two arms of it come forward past the block's flanks: the block's face stands out between them, in the water.)
  b.dry({ x: SLAB.x - 420, y: SLAB.y - 20, w: 190, h: 260 }, 0, 92);
  b.dry({ x: SLAB.x + 236, y: SLAB.y - 70, w: 190, h: 280 }, 0, 92);
  // Attacks: the basin's water is never still round the block and its island.
  for (const [dx, dy, r] of [
    [-330, -40, 190],
    [330, -60, 190],
    [0, -190, 210],
    [-430, 230, 190],
    [450, 220, 190],
    [0, 470, 190],
  ]) {
    b.agitate(pt(SLAB.x + dx, SLAB.y + dy), r, 0.22);
  }

  // Below the basin the river narrows, bends east, and comes round to the foot of the cliff.
  b.channel([pt(1440, 5560 + DY), pt(1500, 5900 + DY), pt(1750, 6300 + DY), pt(2100, 6520 + DY), pt(2330, 6700 + DY), pt(2335, 6830 + DY), pt(2230, lipY(2230) - LIP.foot - CONF_RIVER.w / 2)], {
    width: [320, 300, 190, 200, 210, 215, CONF_RIVER.w],
  });
  // Along the cliff's foot, west: it takes the seven streams one after another and is wider after each.
  const widths = TRIBS.map((_, i) => ((tribs[i] ?? 0) > 0 ? tribWidth(tribs[i]) : 0));
  const reach: Pt[] = [];
  const reachW: number[] = [];
  for (let x = 2230; x >= 1150; x -= 60) {
    const w = confRiverWidth(x, widths);
    reach.push(pt(x, lipY(x) - LIP.foot - w / 2));
    reachW.push(w);
  }
  b.channel(reach, { width: reachW, straight: true });
  const below = confRiverWidth(1150, widths);
  // The streams: each as wide as its count, across the snowfield and over the lip.
  TRIBS.forEach((t, i) => {
    const w = widths[i];
    if (w <= 0) return;
    b.channel([t.head, t.mid, pt(t.mouth.x, t.mouth.y + 70), pt(t.mouth.x, t.mouth.y - LIP.foot - 30)], { width: [w * 0.55, w * 0.8, w, w], speed: 1 });
    b.disc(t.head, w * 0.42 + 6);
    b.agitate(pt(t.mouth.x, t.mouth.y - LIP.foot - 30), 50 + w * 0.6, 0.5 + 0.05 * Math.min(tribs[i], 9));
  });
  // The bigger river below it swings north again past the pool.
  const last = reach[reach.length - 1];
  b.channel([last, pt(940, 7240 + DY), pt(860, 7520 + DY), pt(820, 7950 + DY), pt(680, 8450 + DY), pt(650, 8800 + DY), pt(720, 9200 + DY), pt(1080, 9800 + DY), pt(1350, 10150 + DY)], {
    width: [below, below * 0.98, below * 0.94, below * 0.88, 400, 360, 340, 340, 420],
  });

  // The rock pool: an irregular shore, fed by its own melt and drained by a brook that runs on to the tarn.
  const shore = new Path2D();
  POOL_SHORE.forEach(([x, y], i) => {
    const [nx, ny] = POOL_SHORE[(i + 1) % POOL_SHORE.length];
    const mx = (x + nx) / 2;
    const my = (y + ny) / 2 + DY;
    if (i === 0) shore.moveTo(mx, my);
    else shore.quadraticCurveTo(x, y + DY, mx, my);
  });
  shore.quadraticCurveTo(POOL_SHORE[0][0], POOL_SHORE[0][1] + DY, (POOL_SHORE[0][0] + POOL_SHORE[1][0]) / 2, (POOL_SHORE[0][1] + POOL_SHORE[1][1]) / 2 + DY);
  shore.closePath();
  b.fill(shore);
  b.channel([pt(1800, 9620 + DY), pt(1720, 9760 + DY), pt(1640, 9900 + DY), pt(1700, 10080 + DY), pt(1800, 10260 + DY), pt(1860, 10420 + DY)], { width: [56, 40, 44, 40, 46, 60], speed: 0.7 });
  b.channel([pt(1740, 9250 + DY), pt(2080, 9400 + DY), pt(1830, 9610 + DY)], { width: 300, speed: 0.08, flowOnly: true });

  // The tarn: wide, dark and still.
  const tarn = new Path2D();
  tarn.ellipse(TARN.x, TARN.y, TARN.rx, TARN.ry, 0, 0, Math.PI * 2);
  b.fill(tarn);
  b.disc(pt(TARN.x - 560, TARN.y - 330), 250);
  b.disc(pt(TARN.x + 520, TARN.y + 380), 260);
  b.disc(pt(TARN.x + 600, TARN.y - 280), 190);
  b.disc(pt(TARN_BAY.x, TARN_BAY.y), TARN_BAY.r);
  // (And the bay runs on into the tarn's western lobe: no point of land stands between them.)
  b.disc(pt(TARN_BAY.x - 200, TARN_BAY.y + 200), 190);
  // (The river slows as it comes into the bay: under the eye that looks across the tarn the water is all but still.)
  b.channel([pt(TARN_BAY.x - 150, TARN_BAY.y - 260), pt(TARN_BAY.x, TARN_BAY.y), pt(TARN_BAY.x + 150, TARN_BAY.y + 230)], { width: 560, speed: 0.1, flowOnly: true });
  b.channel([pt(1350, 10150 + DY), pt(1330, 10400 + DY), pt(1300, 10800 + DY), pt(1300, 11400 + DY)], { width: 400, speed: 0.1, flowOnly: true });

  paintLater(b, gate);

  paintDelta(b);
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
  b.channel([pt(1300, T2 + 1400), pt(1240, T2 + 1800), pt(1300, DAM.y - DAM.pond - 30), pt(1300, DAM.y - DAM.pond + 150)], { width: [330, 280, 380, 620], speed: 0.45 });
  // (The pond is a real reservoir: deep, dark water the wall stands against.)
  b.pool({ x: DAM.x0 + 70, y: DAM.y - DAM.pond, w: DAM.x1 - DAM.x0 - 140, h: DAM.pond + 10 }, 150);
  b.disc(pt(DAM.x0 + 210, DAM.y - DAM.pond + 110), 170);
  b.disc(pt(DAM.x1 - 190, DAM.y - DAM.pond + 150), 190);
  // (All three channels are carved to run: which one does is the picture's to say, sluice by sluice, so a change of
  // the switch needs no new bed and costs no frame. A shut channel's bare bed is drawn over its water.)
  void gate;
  for (const line of SLUICES) {
    b.channel(line, { width: [DAM.gw, DAM.gw + 16, 130, 130, 150], speed: 1 });
    b.agitate(pt(line[0].x, DAM.y + DAM.thick + DAM.h * DAM.batter + 30), 120, 0.6);
  }
  // The three meet and run on into the still pool.
  b.channel([pt(1300, DAM.y + 960), pt(1300, DAM.y + 1150), pt(1300, T2 + 4060)], { width: [300, 260, 300] });
  const half = LATTICE.pitch * 2 + 110;
  b.pool({ x: LATTICE.x - half, y: LATTICE.y - half, w: half * 2, h: half * 2 }, 210);
  b.disc(pt(LATTICE.x + half - 70, LATTICE.y + 260), 190);
  b.disc(pt(LATTICE.x + half - 40, LATTICE.y - 230), 180);
  b.channel([pt(1300, LATTICE.y - half - 200), pt(1300, LATTICE.y), pt(1300, LATTICE.y + half + 200)], { width: half * 2.6, speed: 0.04, flowOnly: true, straight: true });
  // Out of the pool, into the canyon, and round to the run-out.
  b.channel([pt(1300, LATTICE.y + half - 40), pt(1300, T2 + 5200), pt(1300, T2 + 5360)], { width: [260, 200, CANYON.w] });
  b.channel(CANYON_LINE, { width: CANYON.w, straight: true });
  // (The outside of the second bend is cut square: a flat wall faces the water that comes at it.)
  b.pool({ x: HALL.x0, y: HALL.y0 - 12, w: HALL.x1 - HALL.x0 + 20, h: HALL.y1 - HALL.y0 + 24 }, 16);
  b.channel([pt(2020, T2 + 7100), pt(1990, T2 + 7330), pt(1800, T2 + 7560), DELTA.apex], { width: [CANYON.w, 220, 270, 300], speed: 0.7 });
  // Fast water on the outside of each bend.
  for (const c of BENDS) {
    const out = c.turn < 0 ? pt(c.x - 0.75 * CANYON.r, c.y + 0.75 * CANYON.r) : pt(c.x + 0.75 * CANYON.r, c.y - 0.75 * CANYON.r);
    b.agitate(out, 150, 0.8);
  }
}

/** The delta's channels and the sea they run out into. */
function paintDelta(b: BedPainter) {
  const Y = T2;
  const A = DELTA.apex;
  // The sea: everything north of a coast that runs from the western cape round the delta's front to the east.
  const coast: [number, number][] = [
    [-900, 9760],
    [300, 9700],
    [820, 9600],
    [1120, 9420],
    [1300, 9180],
    [1470, 9020],
    [1700, 8990],
    [1900, 8900],
    [2080, 8760],
    [2240, 8600],
    [2400, 8470],
    [2560, 8370],
    [2800, 8300],
    [3400, 8260],
  ];
  const sea = new Path2D();
  sea.moveTo(-900, WORLD.h + 600);
  for (const [x, y] of coast) sea.lineTo(x, Y + y);
  sea.lineTo(3400, WORLD.h + 600);
  sea.closePath();
  b.fill(sea);
  // Bays along it, so the coast is never a ruled line.
  for (const [x, y, r] of [
    [60, 9700, 210],
    [600, 9640, 170],
    [1010, 9500, 140],
    [1620, 9000, 120],
    [2010, 8830, 110],
    [2330, 8530, 100],
    [2700, 8330, 120],
  ]) {
    b.disc(pt(x, Y + y), r);
  }
  // Distributaries: each a slow, shallow channel; they part and meet, and the bars between them stay dry.
  const run = (pts: [number, number][], width: number[], speed = 0.5) =>
    b.channel(
      pts.map(([x, y]) => pt(x, Y + y)),
      { width, speed },
    );
  const a: [number, number] = [A.x, A.y - Y];
  // West arm: north along the bank, to the cape's inner bay.
  run([a, [1470, 8020], [1400, 8330], [1450, 8650], [1520, 8900], [1560, 9080]], [230, 150, 120, 130, 170, 260]);
  // Middle arm.
  run([a, [1640, 8030], [1720, 8300], [1770, 8580], [1860, 8800], [1930, 8960]], [230, 130, 110, 120, 160, 250]);
  // East arm: toward the light.
  run([a, [1760, 7930], [1980, 8090], [2200, 8220], [2420, 8350], [2600, 8420]], [230, 140, 120, 130, 170, 260]);
  // Braids between them.
  run([[1410, 8300], [1540, 8440], [1690, 8520], [1770, 8600]], [70, 80, 80, 90], 0.4);
  run([[1700, 8240], [1860, 8340], [2020, 8490], [2150, 8640], [2230, 8720]], [80, 90, 100, 120, 200], 0.45);
  run([[1950, 8070], [1960, 8240], [2030, 8400], [2040, 8500]], [70, 70, 80, 90], 0.4);
  run([[1445, 8620], [1580, 8760], [1700, 8900], [1760, 9000]], [60, 70, 90, 160], 0.4);
  run([[2190, 8215], [2260, 8380], [2330, 8520]], [70, 80, 150], 0.4);
  run([[1765, 8560], [1930, 8640], [2060, 8770]], [70, 80, 150], 0.4);
  // More braids, at their own angles: they cut the bars into shapes that are not alike (long spits, a round holm, slivers).
  run([[1480, 8090], [1560, 8200], [1600, 8330], [1570, 8470]], [50, 56, 60, 70], 0.35);
  run([[1830, 8170], [1900, 8260], [2040, 8300], [2130, 8300]], [50, 60, 60, 70], 0.4);
  run([[1930, 8610], [2020, 8600], [2120, 8660], [2180, 8760]], [54, 60, 70, 110], 0.4);
  run([[1600, 8660], [1690, 8700], [1790, 8740], [1880, 8830]], [50, 56, 64, 100], 0.35);
  // Bars that stand in the water itself: a spit in each mouth, and a last low bar out in the sea on the way to the light.
  b.dry({ x: 1512, y: Y + 8930, w: 46, h: 120 }, 0, 23);
  b.dry({ x: 1888, y: Y + 8850, w: 40, h: 96 }, 0, 20);
  b.dry({ x: 2380, y: Y + 8400, w: 130, h: 36 }, 0, 18);
  b.dry({ x: 1830, y: Y + 9210, w: 230, h: 54 }, 0, 27);
  b.dry({ x: 2110, y: Y + 9130, w: 90, h: 40 }, 0, 20);
  // The sea's own slow set, outward from the mouths.
  for (const [x0, y0, x1, y1] of [
    [1560, 9050, 1700, 9900],
    [1930, 8950, 2200, 9900],
    [2420, 8500, 2600, 9900],
  ]) {
    b.channel([pt(x0, Y + y0), pt(x1, Y + y1)], { width: 700, speed: 0.22, flowOnly: true, straight: true });
  }
}

export interface NameRaster {
  alpha: Uint8ClampedArray;
  tw: number;
  th: number;
  /** world units per texel */
  scale: number;
  rect: Rect;
  /** each line of letters, in the raster's true units up from its middle: where its baseline and the top of its capitals lie */
  lines: { base: number; cap: number }[];
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
  const lines: NameRaster['lines'] = [];
  layout.lines.forEach((text, i) => {
    const m = ctx.measureText(text);
    const asc = m.actualBoundingBoxAscent || fontPx * 0.72;
    // Each line's capitals are centred in its band.
    const mid = -textH / 2 + lineH * (i + 0.5);
    const baseline = mid + asc / 2;
    lines.push({ base: -baseline * k, cap: (asc - baseline) * k });
    const start = -runOf(text) / 2;
    let x = start;
    for (let n = 0; n < text.length; n++) {
      ctx.fillText(text[n], x, baseline);
      x = start + ctx.measureText(text.slice(0, n + 1)).width + ls * (n + 1);
    }
  });
  return { alpha: ctx.getImageData(0, 0, tw, th).data, tw, th, scale, rect, lines };
}
