/**
 * The name as eight plates of lake ice: ARAV JAIN, capitals of the site's
 * display face, sawn from the sheet and stood on end.
 *
 * Each letter is a plate of its own: an outline (one cell of a raster, from
 * which a distance field is made) carried straight back through a fifth of
 * its height. A plate has its own place, size and turn on the lake, so it
 * can settle, tip and founder at its own moment, roll flat and ride on as a
 * berg (see `plateAt`). Everything here is a pure function of the layout and
 * of the melt, so the page scrolled back stands every plate up again.
 */

import { NAME, OUTLET, LAKE } from './world';

/** The letters, in the order they are read. */
export const NAME_TEXT = 'ARAVJAIN';
export const PLATES = NAME_TEXT.length;

/**
 * The cut of the letters. `weight`: the display face's weight (it is a
 * variable face). `gap`, `word`: the room between two plates and between
 * the two words, in capitals' heights, measured optically (the mean width
 * of the gap over the letters' height, so an A and a V stand as close as
 * two stems do). `least`: no two plates come nearer than this anywhere: a
 * hand passes through every gap. `depth`: a plate's depth front to back.
 */
export interface NameCut {
  weight: number;
  gap: number;
  word: number;
  least: number;
  depth: number;
}
export const NAME_CUT: NameCut = { weight: 640, gap: 0.2, word: 0.5, least: 0.085, depth: 0.2 };

/** The raster's cells: four across, two up; each this many capitals' heights wide and tall, with this much room under the baseline. */
export const CELL = { cols: 4, rows: 2, w: 1.3, h: 1.3, foot: 0.15 };

export interface NameGlyphs {
  /** the raster as the canvas gives it: four bytes a texel, the first of them the letter's cover */
  alpha: Uint8ClampedArray;
  tw: number;
  th: number;
  /** texels to a capital's height */
  cap: number;
  /** each letter's ink, left and right of its cell's middle, in capitals' heights */
  ink: [number, number][];
  /** each letter's left and right edge at `PROFILE` heights up it (from its cell's middle, in capitals' heights) */
  left: number[][];
  right: number[][];
  /**
   * Each row the name can stand in, drawn whole under the cells (the plates as they stand side by side), for
   * what is asked of a row at once (its shade on the sheet, its image in the ice): the row's letters, where each
   * letter's middle stands from the row's own (capitals' heights), half the row's width ink to ink, and where the
   * row's middle and its baseline lie in the raster (texels).
   */
  strips: Record<string, { ids: number[]; mids: number[]; half: number; x: number; y: number }>;
}
const PROFILE = 24;
/** The rows the name stands in: one row of eight on a wide screen, two rows of four on an upright one. */
export const ROWS = ['ARAV JAIN', 'ARAV', 'JAIN'];
/** How much room a row's strip has round its ink, in capitals' heights. */
const STRIP_PAD = 0.22;

/**
 * The eight letters, each drawn in its own cell: white on nothing, its
 * baseline `CELL.foot` up from the cell's lower edge, its ink centred. The
 * raster's rows run upward (row 0 is the foot), as the texture's do.
 */
export function rasterGlyphs(fontFamily: string, cut: NameCut = NAME_CUT, cap = 224): NameGlyphs {
  const weight = cut.weight;
  const cw = Math.round(CELL.w * cap);
  const ch = Math.round(CELL.h * cap);
  // (Under the two rows of cells: a strip for the one long row, and a strip the two short rows share.)
  const tw = Math.max(cw * CELL.cols, Math.round(7.6 * cap));
  const th = ch * (CELL.rows + 2);
  const c = document.createElement('canvas');
  c.width = tw;
  c.height = th;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  // The size at which a capital is `cap` texels tall.
  ctx.font = `${weight} 200px ${fontFamily}`;
  const asc = ctx.measureText('I').actualBoundingBoxAscent || 144;
  const px = (200 * cap) / asc;
  const font = `${weight} ${px}px ${fontFamily}`;
  // (White on black: a texel's first byte is then how much of it the letter covers.)
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, tw, th);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  const ink: [number, number][] = [];
  for (let i = 0; i < PLATES; i++) {
    const col = i % CELL.cols;
    const row = Math.floor(i / CELL.cols);
    // (Rows run upward: the letter is drawn head down in the canvas.)
    ctx.setTransform(1, 0, 0, -1, col * cw + cw / 2, row * ch + CELL.foot * cap);
    ctx.font = font;
    const m = ctx.measureText(NAME_TEXT[i]);
    const l = m.actualBoundingBoxLeft;
    const r = m.actualBoundingBoxRight;
    // A plate stands on a sawn foot: a round letter is set a hair into the sheet, so its foot is a flat and not a point.
    const sunk = Math.max(0, m.actualBoundingBoxDescent) + (NAME_TEXT[i] === 'J' ? 0.012 * cap : 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-cw / 2, -ch, cw, ch);
    ctx.clip();
    ctx.fillText(NAME_TEXT[i], (l - r) / 2, sunk);
    ctx.restore();
    ink.push([-(l + r) / 2 / cap, (l + r) / 2 / cap]);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let alpha = ctx.getImageData(0, 0, tw, th).data;
  // Each letter's two edges, at heights up it: what its neighbours are set against.
  const left: number[][] = [];
  const right: number[][] = [];
  for (let i = 0; i < PLATES; i++) {
    const col = i % CELL.cols;
    const row = Math.floor(i / CELL.cols);
    const x0 = col * cw;
    const L: number[] = [];
    const R: number[] = [];
    let lo = cw;
    let hi = 0;
    for (let k = 0; k < PROFILE; k++) {
      const y = Math.round(row * ch + (CELL.foot + 0.03 + (0.94 * (k + 0.5)) / PROFILE) * cap);
      let a = cw;
      let b = -1;
      for (let x = 0; x < cw; x++) {
        if (alpha[(y * tw + x0 + x) * 4] > 127) {
          if (x < a) a = x;
          b = x;
        }
      }
      L.push(b < 0 ? Infinity : (a - cw / 2) / cap);
      R.push(b < 0 ? -Infinity : (b + 1 - cw / 2) / cap);
      if (b >= 0) {
        lo = Math.min(lo, a);
        hi = Math.max(hi, b + 1);
      }
    }
    left.push(L);
    right.push(R);
    ink[i] = [(lo - cw / 2) / cap, (hi - cw / 2) / cap];
  }
  // The rows, each drawn whole from its letters' cells, set as they will stand.
  const g: NameGlyphs = { alpha, tw, th, cap, ink, left, right, strips: {} };
  ctx.globalCompositeOperation = 'lighten';
  let sx = 0;
  ROWS.forEach((text, r) => {
    const ids: number[] = [];
    const mids: number[] = [];
    let x = 0;
    let word = false;
    let i = text === 'JAIN' ? 4 : 0;
    for (const c of text) {
      if (c === ' ') {
        word = true;
        continue;
      }
      // (Between the two words the room is measured ink to ink: a word is a block.)
      if (ids.length) x += word ? ink[ids[ids.length - 1]][1] + cut.word - ink[i][0] : pairStep(g, ids[ids.length - 1], i, cut.gap, cut.least);
      word = false;
      mids.push(x);
      ids.push(i++);
    }
    const from = mids[0] + ink[ids[0]][0];
    const to = mids[mids.length - 1] + ink[ids[ids.length - 1]][1];
    const mid = (from + to) / 2;
    const half = (to - from) / 2;
    const wide = Math.ceil((2 * half + 2 * STRIP_PAD) * cap);
    // (The long row has a strip to itself; the two short rows stand side by side in the next.)
    if (r !== 2) sx = 0;
    const y0 = ch * (CELL.rows + (r === 0 ? 0 : 1));
    const cx = sx + wide / 2;
    ids.forEach((id, k) => {
      const col = id % CELL.cols;
      const row = Math.floor(id / CELL.cols);
      ctx.drawImage(c, col * cw, row * ch, cw, ch, Math.round(cx + (mids[k] - mid) * cap - cw / 2), y0, cw, ch);
    });
    g.strips[text] = { ids, mids: mids.map((m) => m - mid), half, x: cx, y: y0 + CELL.foot * cap };
    sx += wide + Math.round(0.1 * cap);
  });
  ctx.globalCompositeOperation = 'source-over';
  alpha = ctx.getImageData(0, 0, tw, th).data;
  g.alpha = alpha;
  return g;
}

/** One row of the name as the first frame composes it: its letters, the line on the lake its faces stand on, and how wide it is. */
export interface NameRow {
  text: string;
  /** world y of the faces' plane */
  y: number;
  /** world width, ink to ink */
  width: number;
}

/** A plate as it stands. */
export interface Plate {
  /** the middle of its foot on the lake: x, and the y of its face */
  x: number;
  y: number;
  /** its capitals' height, its ink's half width and its depth front to back, world units */
  h: number;
  hw: number;
  d: number;
  /** which row it stands in (0 is the far one) */
  row: number;
}

/**
 * How far right of a letter's middle the next one's middle stands, in
 * capitals' heights: set so the gap between the two has a given mean width
 * over their height (a gap wider than a third of a capital counts as a third: the
 * open side of a J or the foot of a V is not all room), and so the two never
 * come nearer than `least`.
 */
function pairStep(g: NameGlyphs, a: number, b: number, gap: number, least: number): number {
  const mean = (step: number) => {
    let s = 0;
    let n = 0;
    for (let k = 0; k < PROFILE; k++) {
      const d = step + g.left[b][k] - g.right[a][k];
      if (!Number.isFinite(d)) continue;
      s += Math.min(d, 0.36);
      n++;
    }
    return n ? s / n : step;
  };
  let lo = -1;
  let hi = 3;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (mean(m) < gap) lo = m;
    else hi = m;
  }
  let near = Infinity;
  for (let k = 0; k < PROFILE; k++) {
    // (A stroke's edge a little higher or lower counts too: two diagonals pass each other aslant.)
    for (let j = Math.max(0, k - 1); j <= Math.min(PROFILE - 1, k + 1); j++) near = Math.min(near, g.left[b][j] - g.right[a][k]);
  }
  return Math.max(hi, least - near);
}

/** Where each of the eight plates stands, for the rows the first frame composes. */
export function layoutName(rows: NameRow[], g: NameGlyphs, cut: NameCut = NAME_CUT): Plate[] {
  const out: Plate[] = [];
  rows.forEach((row, r) => {
    const st = g.strips[row.text];
    const h = row.width / (2 * st.half);
    st.ids.forEach((id, k) => {
      out[id] = { x: NAME.x + st.mids[k] * h, y: row.y, h, hw: ((g.ink[id][1] - g.ink[id][0]) / 2) * h, d: cut.depth * h, row: r };
    });
  });
  return out;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * The foundering, in the melt's own measure (0..1 of the lake's melt). The
 * plates go one at a time, never left to right and never two neighbours
 * running: `order[k]` is the letter that goes k-th (the sound's own order
 * of their going, so each is heard as it is seen). They go across the
 * stretch `left` (the host's `left`: how many still stand), each at the
 * point of it where its turn's share has gone, and each takes `each` of the
 * melt to go down and roll flat.
 */
export const FOUNDER = { left: [0.5, 0.586], each: 0.085, order: [4, 7, 2, 5, 0, 3, 6, 1], from: 0.47, to: 0.63 };
/** The melt at which plate `i` goes down into the water (the middle of its foundering). */
export const goesAt = (i: number) => {
  const v = (FOUNDER.order.indexOf(i) + 0.5) / PLATES;
  // (Where the smooth step over `left` has come to v.)
  const t = 0.5 - Math.sin(Math.asin(1 - 2 * v) / 3);
  return FOUNDER.left[0] + (FOUNDER.left[1] - FOUNDER.left[0]) * t;
};
/** The melt at which plate `i` begins to founder. */
export const founderAt = (i: number) => goesAt(i) - 0.4 * FOUNDER.each;

/** How far the water stands under the sheet's top, and how much of a floating plate's depth rides over it. */
const AFLOAT = { free: 22, over: 0.14 };
/** The stretch of the melt in which the sheet opens under the rows (the host's `hole`) and the plates settle into that water. */
const STAND_IN = [0.34, 0.5];
/** How much of a foundered plate's height still stands over the water, on end. */
const SUNK = { over: 0.5 };
/**
 * The roll. A foundered plate stands on end in the water until the eye has begun to lift over the lake; then, each
 * at its own moment from `from` across `spread` of the melt, it lies back flat (it takes `takes`) and floats. A plate
 * seen flat from low down would be a sliver: seen from the height the eye then has, it is the letter.
 */
const ROLL = { from: 0.635, spread: 0.05, takes: 0.07 };

/**
 * Where the lead that carries the lake's water to the outlet lies at a
 * distance down the lake (the ice field's leadAt, the same numbers).
 * `y0`: behind the far row; `x0`: where it leaves the name.
 */
export function leadX(y: number, y0: number, x0: number): number {
  const t = Math.min(1, Math.max(0, (y - y0) / Math.max(LAKE.y1 - y0, 1)));
  const s = t * t * (3 - 2 * t);
  const wander = (150 * Math.sin(t * 6.1 + 0.8) + 56 * Math.sin(t * 17.0 + 2.3) + 20 * Math.sin(t * 43.0 + 1.1)) * smooth(0, 0.14, t) * (1 - smooth(0.86, 1, t));
  return x0 + (OUTLET.x - x0) * s + wander;
}

export interface PlatePose {
  /** the plate's middle, world */
  pos: [number, number, number];
  /** its turn: a quaternion (x, y, z, w) from the plate's own frame (x across, y back through it, z up it) to the world's */
  q: [number, number, number, number];
  /** its footing on the lake: the middle, the half size across and front to back, and the turn on the lake (radians) */
  foot: [number, number, number, number];
  yaw: number;
  /** 0 standing, 1 flat afloat */
  flat: number;
  /** 0 on the sheet, 1 foundered: on end in the water, its top over it */
  down: number;
  /** 0..1 how far it has begun to go: the sheet under it is weak */
  weak: number;
  /** how far the sheet has opened round its footing, world units (negative: whole) */
  open: number;
}

const qMul = (a: number[], b: number[]): [number, number, number, number] => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qAxis = (x: number, y: number, z: number, a: number): [number, number, number, number] => {
  const s = Math.sin(a / 2);
  return [x * s, y * s, z * s, Math.cos(a / 2)];
};

/**
 * A plate at a point in the melt. While the sheet holds it stands; as the
 * ice under it weakens it settles a little and tips a few degrees; at its
 * own moment the sheet gives under it and it founders: it goes down on end
 * into the water until only its top stands over it; later it lies back flat,
 * and then it rides low among the floes, face to the sky, and the lake's
 * current takes it toward the outlet.
 * `t`: the picture's clock, for the swell it rides on (0: none).
 * `lead`: where the current's lead leaves the name (y0, x0: see leadX).
 */
export function plateAt(p: Plate, i: number, melt: number, t: number, lead: [number, number]): PlatePose {
  const at = founderAt(i);
  const h1 = hash(i * 3.1 + 0.7);
  const h2 = hash(i * 5.3 + 2.9);
  const h3 = hash(i * 7.7 + 4.1);
  // The weakening: it settles into its own meltwater and leans, here to one side and there to the other.
  const weak = smooth(at - 0.24, at, melt);
  // The foundering: the sheet gives under it and it goes down on end, leaning further, until only its top stands
  // over the water. (The top of a letter is what it is known by: the name still reads.)
  const fall = Math.min(1, Math.max(0, (melt - at) / FOUNDER.each));
  const down = smooth(0, 1, fall);
  // The roll: later, as the eye lifts over the lake, it lies back onto the water, face to the sky, and floats.
  const rollAt = Math.max(at + 1.15 * FOUNDER.each, ROLL.from + ROLL.spread * h2);
  const over = smooth(0, 1, (melt - rollAt) / ROLL.takes);
  const flat = over;
  const after = Math.max(0, melt - rollAt - ROLL.takes * 0.5);
  // The current: slow at first, then it has it. Those that rolled first are furthest down the lake; none leaves it.
  const cx = p.x;
  const cy = p.y + p.d / 2;
  // (They gather well short of the outlet, where the eye comes down low over the water.)
  const room = Math.max(300, Math.min(LAKE.y1 - 1300, cy + 2600) - cy);
  // (Each at its own pace: they string out down the lead and never ride in a heap.)
  const want = ((24000 + 16000 * hash(i * 9.7 + 6.3)) * after * after) / (after + 0.03);
  const run = room * (1 - Math.exp(-want / room));
  const y = cy + run;
  // It is drawn in to the lead, to a lane of its own, and stands off its neighbours along it.
  // (The lanes lie to the lead's right, as the eye flies down it: the first screen's line stands at the frame's lower left.)
  const lane = (0.1 + (((FOUNDER.order.indexOf(i) * 3) % PLATES) / (PLATES - 1)) * 2.0) * p.h * 0.72;
  const inK = smooth(0, 1500, run);
  const x = cx + (leadX(y, lead[0], lead[1]) + lane - cx) * inK;
  // Standing, its middle is half its height over the sheet. Foundered, it stands in the water with its top third
  // over it. Afloat, it lies flat with a little of its depth over the water.
  // (Before any of them goes, the sheet under the rows has opened: each plate has settled through it and stands
  // in its own meltwater, its foot a little under the water.)
  const settle = 0.03 * p.h * weak + (AFLOAT.free + 0.06 * p.h) * smooth(STAND_IN[0], STAND_IN[1], melt);
  const zStand = p.h / 2 - settle;
  const zSunk = -AFLOAT.free - p.h * (0.5 - SUNK.over);
  const zFloat = -AFLOAT.free - p.d / 2 + AFLOAT.over * p.d;
  // (It goes under a little further than it will stand, and comes back up: twice, each time less.)
  const bob = Math.sin(Math.PI * 2.2 * fall) * (1 - fall) * 0.07 * p.h;
  const swell = t ? Math.sin(t * 0.7 + i * 1.9) * (1.2 * down + 0.6 * flat) : 0;
  const zDown = zStand + (zSunk - zStand) * down - bob;
  const z = zDown + (zFloat - zDown) * over + swell;
  // The lean: a few degrees while it stands, more once it is in the water, back or forward and to one side.
  const lean = (0.03 + 0.04 * h1) * weak + (0.05 + 0.06 * h3) * down;
  const tipBack = (h2 - 0.3) * 1.5 * lean * (1 - over);
  const tipSide = (h3 - 0.5) * 2.4 * lean * (1 - over);
  const roll = (-Math.PI / 2) * over;
  const yaw = (h3 - 0.5) * 0.5 * down + (h1 - 0.5) * 1.6 * smooth(0, 0.2, after) + (t ? Math.sin(t * 0.23 + i) * 0.025 * flat : 0);
  const rock = t ? Math.sin(t * 0.9 + i * 2.3) * (0.012 * down + 0.012 * flat) : 0;
  let q = qAxis(1, 0, 0, roll - tipBack + rock);
  q = qMul(qAxis(0, 1, 0, tipSide), q);
  q = qMul(qAxis(0, 0, 1, yaw), q);
  // Its footing: standing, the strip its foot covers; flat, the whole plate.
  const fy = p.d / 2 + (p.h / 2 - p.d / 2) * flat;
  // (As it lies back its middle goes back with it: it comes to float behind where it stood.)
  const back = (p.h / 2) * Math.sin(-roll) * 0.55;
  const yy = y + back * Math.cos(yaw);
  const xx = x - back * Math.sin(yaw);
  // The sheet opens round it as it weakens: a wet patch, a hole it goes down into, then room to float in.
  const open = -30 + 62 * smooth(at - 0.07, at + 0.01, melt) + 0.12 * p.h * down + (0.22 * p.h - 6) * over + 0.2 * p.h * smooth(0, 0.1, after);
  return { pos: [xx, yy, z], q, foot: [xx, yy, p.hw, fy], yaw, flat, down, weak, open };
}
