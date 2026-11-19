import { subjects, WATER_LOW } from './registry';
import { boxInView, boxRectCut, type Rect, type Box } from './projection';
export { boxInView, boxRect, boxRectCut, type Rect, type Box } from './projection';
export { slabInFrame, tarnNear } from './registry';
/**
 * Which parts of the flight's shading pass a frame needs.
 *
 * The pass is one long program, and the GPU driver's cost follows the whole
 * program's shape: code that never runs still slows every pixel. So the pass
 * is compiled in variants, each carrying only some of the flight's subjects
 * (see `flightSource`), and each frame is drawn by the smallest variant that
 * carries everything that frame can show.
 *
 * What a frame can show is worked out here from the camera, by the very
 * rules the pass itself uses to decide whether to look for a subject (each
 * rule below names the line of the pass it mirrors). Where the pass decides
 * by a place on the ground instead, the rule is whether that place can be in
 * the frame at all. So a variant that leaves a subject out draws, for every
 * frame it is chosen for, exactly the picture the whole pass would: the
 * switch from one variant to the next cannot be seen.
 */

import { type Basis } from './camera';
import { stationsNear } from './moments';
import { DELTA, LAKE } from './world';

/** The theme a variant is compiled for: the day's, the night's, or neither (it is told each frame, and draws the turn between them). */
export type Mode = 'day' | 'night' | 'any';

/** One bit to a subject. The ground, the water, the sky and the ranges are in every variant. */
export const F = {
  ...Object.fromEntries(subjects.map(subject => [subject.define.replace(/^F_/, ''), subject.bit])),
  ICE: 1, SEA: 512, NAME: 1024, FIELD: 2048,
} as Record<string, number>;
export const F_ALL = subjects.reduce((mask, subject) => mask | subject.bit, F.ICE | F.SEA | F.NAME | F.FIELD);
/** The name each bit is known by in the pass's source. */
export const F_DEFINES: string[] = [];
for (const [bit, name] of [[F.ICE, 'F_ICE'], [F.SEA, 'SEA'], [F.NAME, 'F_NAME'], [F.FIELD, 'F_FIELD']] as const) F_DEFINES[Math.log2(bit)] = name;
for (const subject of subjects) F_DEFINES[Math.log2(subject.bit)] = subject.define;

/** For the checks: a mask as words. */
export const maskName = (mask: number) =>
  F_DEFINES.filter((_, i) => mask & (1 << i))
    .map((n) => n.replace('F_', '').toLowerCase())
    .join('+') || 'plain';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How near the open sea is: 0 too far to be seen, 1 over it (the pass's uSea.x). */
export function seaNear(cam: Basis): number {
  const toSea = Math.hypot(cam.pos[0] - 1900, cam.pos[1] - DELTA.sea);
  return cam.pos[1] > DELTA.sea ? 1 : 1 - smooth(2600, 3400, toSea);
}

/**
 * What of the lake's ice there is to draw at a point in its melt.
 *  - on: the sheet, in any part. From the melt at which the last floe has gone (the engine's ICE_GONE) the pass asks
 *    nothing of the ice field: `hasIce` is false everywhere, the name's pond and the sheet's own water are nothing
 *    (`sheetK`, `pondK` and `gDeep` in the water are all 0 by then). What the melt still does to the lake's water after
 *    that (`uGlow`, `uMeltAct`) is told to every variant.
 *  - blocks: the letters. They have gone under when `uNameM.w` is 0 (bindIce: `left`), and with it their shade, their
 *    image, what stands under the water and the pieces afloat are all nothing.
 *  - field: the swept ice. By day it lies on whatever of the sheet is left; before dawn it is rimed over once the sheet
 *    is plates (nameCover: `K *= 1.0 - uNight * smoothstep(0.5, 0.64, uIceA.z)`).
 */
export interface IceParts {
  on: boolean;
  blocks: boolean;
  field: boolean;
}
export const NO_ICE: IceParts = { on: false, blocks: false, field: false };
/** The melt at which the last floe is gone (the engine's ICE_GONE). */
const MELT_GONE = 0.9;
/**
 * @param melt 0..1
 * @param night 0 by day, 1 before dawn, between while the theme turns
 * @param stands whether the name stands on the sheet as blocks (the home page; an inner page's lake has none)
 */
export function iceParts(melt: number, night: number, stands: boolean): IceParts {
  const on = melt < MELT_GONE;
  // (The plates founder one by one and then ride on as bergs while any of the sheet is left: they are there as long as it is.)
  return { on, blocks: on && stands, field: on && stands };
}

/**
 * Where anything of the lake's ice can be, along the valley: the sheet lies on the lake (`hasIce`: within 80 units of
 * its two shores), the water it shades or stands in is the lake's (`lakeK`: to 290 units past the south shore, found
 * up to a few hundred units on under a bent ray), and the letters stand on it. Across the valley it has no end.
 */
const LAKE_Y: [number, number] = [LAKE.y0 - 600, LAKE.y1 + 900];
/**
 * Whether any ray of the frame can reach a stretch of the valley (all that lies between two distances down it, at any
 * height, however far to either side). From inside it, yes. From outside, only if some ray of the frame heads back
 * toward it: the frame's rays are spanned by its four corners, so if none of those does, none does.
 */
export function reachInView(cam: Basis, aspect: number, y0: number, y1: number): boolean {
  const cy = cam.pos[1];
  if (cy >= y0 && cy <= y1) return true;
  const tx = cam.tan * aspect * 1.03 + 0.002;
  const ty = cam.tan * 1.03 + 0.002;
  const side = Math.abs(cam.r[1]) * tx + Math.abs(cam.u[1]) * ty;
  return cy > y1 ? cam.f[1] - side < 0 : cam.f[1] + side > 0;
}

/** Where the sheet, its water and what lies on it can be in the frame: the lake's own ground and water, from side to side of the world and beyond. */
const LAKE_GROUND: Box = [
  [-60000, LAKE_Y[0], WATER_LOW],
  [60000, LAKE_Y[1], 24],
];
/**
 * Where the swept field can be. It is laid out in the first camera's picture of the name (nameSwept), up to about
 * four of the name's half heights above its middle, and the far shore and the horizon stand about there in that
 * picture: so its faint far end lies on all the ground from the lake to the horizon, the land beyond the lake too.
 */
const FIELD_GROUND: Box = [
  [-400000, LAKE_Y[0], WATER_LOW],
  [400000, 400000, 24],
];

/**
 * A frame, cut into parts that each need less than the whole.
 *
 * A subject the pass looks for by place stands in a part of the frame: the lake's sheet and the name on it (the
 * lake's own ground and water, and the letters' box), the block and what it does to the ground and water round it,
 * the confluence's trails in the river, the pool's water. Outside that part the pass with the subject and the pass
 * without it draw the same pixel, and the one without it is the cheaper (a subject's code slows a pixel that never
 * runs it, and two subjects in one program cost more than the two apart). So each such subject is given its
 * rectangle, the frame is cut along the rectangles' edges, and every piece is drawn once, by a variant that carries
 * what stands in that piece and nothing else. A subject that fills nearly all of the frame is the frame's own.
 * @param need what the whole frame needs (passNeeds)
 * @param nameBox the box the name's plates are in, and the box of ground their image and their shade lie on
 * @param w, h the frame's size in device pixels
 * @returns each different need, with the pieces of the frame that have it (x, y, width, height in device pixels, y up)
 */
export interface Tile {
  mask: number;
  px: [number, number, number, number][];
  /** the share of the frame these pieces cover */
  area: number;
}
export function frameTiles(cam: Basis, aspect: number, need: number, nameBox: Box[] | null, w: number, h: number): Tile[] {
  const whole: Tile[] = [{ mask: need, px: [[0, 0, w, h]], area: 1 }];
  const parts: { bits: number; r: [number, number, number, number] }[] = [];
  const take = (bits: number, r: Rect | null) => {
    if (!bits) return;
    if (!r) return;
    // (In whole pixels, with a little room; a part that is nearly the frame is not cut out of it.)
    const x0 = Math.max(0, Math.floor(r[0] * w) - 2);
    const y0 = Math.max(0, Math.floor(r[1] * h) - 2);
    const x1 = Math.min(w, Math.ceil(r[2] * w) + 2);
    const y1 = Math.min(h, Math.ceil(r[3] * h) + 2);
    if (x1 <= x0 || y1 <= y0) {
      // (Looked for by place, and that place is not in the frame: no piece of the frame needs it.)
      need &= ~bits;
      return;
    }
    if ((x1 - x0) * (y1 - y0) > 0.86 * w * h) return;
    parts.push({ bits, r: [x0, y0, x1, y1] });
  };
  const NONE: Rect = [0, 0, 0, 0];
  const join = (a: Rect | null, b: Rect | null): Rect | null => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  // (The plates are a subject of their own on the lake: their code is carried only where they, their image in the ice
  // and their shade can be, and the rest of the lake is drawn without it.)
  const lake = need & (F.ICE | F.FIELD);
  // (The boxes' parts of the frame, taken together: the plates' own, and the ground before them.)
  const name = need & F.NAME && nameBox ? nameBox.map((b) => boxRectCut(cam, aspect, b)).reduce((a, b) => join(a, b), null as Rect | null) : null;
  if (lake) take(lake, join(boxRectCut(cam, aspect, need & F.FIELD ? FIELD_GROUND : LAKE_GROUND), name) ?? NONE);
  if (need & F.NAME) take(F.NAME, name ?? NONE);
  let small: { bit: number; rect: Rect } | null = null;
  for (const subject of subjects) {
    if (!(need & subject.bit) || subject.wholeWhen?.(cam)) continue;
    let rect = subject.silhouette?.(cam, aspect) ?? null;
    if (subject.silhouette && !rect) continue;
    for (const box of subject.boxes) rect = join(rect, boxRectCut(cam, aspect, box));
    if (subject.combine && rect) {
      if (small) {
        const both = join(small.rect, rect)!;
        if ((both[2] - both[0]) * (both[3] - both[1]) < 0.06) {
          take(small.bit | subject.bit, both);
          small = null;
          continue;
        }
        take(small.bit, small.rect);
      }
      small = { bit: subject.bit, rect };
    } else take(subject.bit, rect ?? NONE);
  }
  if (small) take(small.bit, small.rect);
  if (!parts.length) {
    whole[0].mask = need;
    return whole;
  }
  let base = need;
  for (const q of parts) base &= ~q.bits;
  // The frame is cut along every edge of every part; each piece then lies wholly inside or outside each part.
  const xs = [...new Set([0, w, ...parts.flatMap((q) => [q.r[0], q.r[2]])])].sort((a, b) => a - b);
  const ys = [...new Set([0, h, ...parts.flatMap((q) => [q.r[1], q.r[3]])])].sort((a, b) => a - b);
  const maskAt = (x: number, y: number) => {
    let m = base;
    for (const q of parts) if (x >= q.r[0] && x < q.r[2] && y >= q.r[1] && y < q.r[3]) m |= q.bits;
    return m;
  };
  // Pieces side by side with the same need are one piece; so are pieces one over the other with the same span.
  const open = new Map<string, [number, number, number, number]>();
  const tiles = new Map<number, Tile>();
  const close = (mask: number, r: [number, number, number, number]) => {
    let t = tiles.get(mask);
    if (!t) tiles.set(mask, (t = { mask, px: [], area: 0 }));
    t.px.push(r);
    t.area += (r[2] * r[3]) / (w * h);
  };
  for (let j = 0; j < ys.length - 1; j++) {
    const row: [number, number, number][] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const m = maskAt(xs[i], ys[j]);
      const last = row[row.length - 1];
      if (last && last[2] === m) last[1] = xs[i + 1];
      else row.push([xs[i], xs[i + 1], m]);
    }
    const seen = new Set<string>();
    for (const [a, b, m] of row) {
      const key = `${a}:${b}:${m}`;
      seen.add(key);
      const up = open.get(key);
      if (up) up[3] += ys[j + 1] - ys[j];
      else open.set(key, [a, ys[j], b - a, ys[j + 1] - ys[j]]);
    }
    for (const [key, r] of open) {
      if (seen.has(key)) continue;
      close(Number(key.split(':')[2]), r);
      open.delete(key);
    }
  }
  for (const [key, r] of open) close(Number(key.split(':')[2]), r);
  // (The largest first: it is the frame's own.)
  return [...tiles.values()].sort((a, b) => b.area - a.area);
}

/**
 * What the pass needs to carry to draw this frame whole.
 * @param ice what of the lake's ice there is to draw (iceParts)
 * @param slab the block has its picture and is drawn
 */
export function passNeeds(cam: Basis, aspect: number, ice: IceParts, slab: boolean): number {
  let need = 0;
  // The sheet, the swept field and the letters: each while it is there, and only while the lake can be in the frame.
  if (ice.on && reachInView(cam, aspect, LAKE_Y[0], LAKE_Y[1])) {
    need |= F.ICE;
    if (ice.field) need |= F.FIELD;
    if (ice.field && ice.blocks) need |= F.NAME;
  }
  const lanes = stationsNear(cam.pos);
  for (const subject of subjects) {
    if (subject.visible) {
      if (subject.visible(cam, aspect, slab)) need |= subject.bit;
      continue;
    }
    if (subject.proximity) {
      if (lanes[subject.proximity.lane] > 0) need |= subject.bit;
      continue;
    }
    if (subject.wholeWhen?.(cam)) {
      need |= subject.bit;
      continue;
    }
    for (const [lo, hi] of subject.boxes) {
      if (subject.reach !== undefined && Math.hypot(...lo.map((v, i) => Math.max(v - cam.pos[i], cam.pos[i] - hi[i], 0))) > subject.reach) continue;
      if (boxInView(cam, aspect, lo, hi)) {
        need |= subject.bit;
        break;
      }
    }
  }
  if (seaNear(cam) > 0) need |= F.SEA;
  return need;
}

/** How many subjects a mask carries. */
export function bits(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}
